# Workcell HTTP API (contract)

The workcell is one Linux container image (`containers/workcell`) with a single Go
binary, `workcell`, that runs in one of three roles:

| Role | Command | Purpose |
|---|---|---|
| `workcell` | `workcell serve --listen :8080` (role from `--role` or `$LIVEMAIN_ROLE`; the image's default command is `serve --listen :8080`) | Hosts agent workspaces (FUSE `livefs` mounts or plain git clones), runs tests, does checkpoints |
| `integrator` | `workcell serve --listen :8080 --role integrator` | Same API plus `/integrate` and `/ci`; the only writer of `refs/heads/main` in live-main mode |
| `gitserver` | `workcell serve-git --listen :8090 --root /srv/git` | Local stand-in for Cloudflare Artifacts: git smart-HTTP over bare repos (`git http-backend`), `receive.denyNonFastForwards=true` |

All bodies are JSON. Errors: non-2xx with `{"error": "<code>", "message": "..."}`.
Paths are repo-relative, forward slashes, no leading `/`, and never contain `..`.
File contents are UTF-8 strings (the demo repo is text only). A `null` content in a
change means delete.

## Environment / config

| Env | Meaning |
|---|---|
| `LIVEMAIN_DATA` | data root, default `/var/livemain` (mirror at `$LIVEMAIN_DATA/mirror.git`, uppers at `$LIVEMAIN_DATA/upper/<ws>`, mounts at `$LIVEMAIN_DATA/mnt/<ws>`) |
| `LIVEMAIN_DEPS` | dir containing the demo repo `node_modules`, default `/deps/node_modules` |
| `LIVEMAIN_SIGDIFF` | path to sigdiff CLI, default `/opt/livemain/sigdiff.cjs` |
| `LIVEMAIN_MERGIRAF` | path to mergiraf binary, default `mergiraf` on PATH (optional; fallback merges used if missing) |

## Health

`GET /health` → `{ "ok": true, "role": "workcell"|"integrator", "workspaces": <n>, "mergiraf": bool }`

## Workspaces

`POST /workspaces`
```json
{ "id": "agent-17", "kind": "livefs" | "clone",
  "remote": "http://gitserver:8090/main.git",
  "sha": "<commit sha to pin>",           // livefs: lower layer commit. clone: checkout this sha
  "branch": "agent/agent-17" }            // clone only: local branch name to create at sha
```
→ `{ "id", "path": "/var/livemain/mnt/agent-17", "sha", "generation": 1 }`

- `livefs`: fetches `sha` into the shared mirror (if missing), mounts a FUSE union at
  `path`: lower = git tree of `sha` read from the mirror (no checkout), upper =
  `$LIVEMAIN_DATA/upper/<id>`. A virtual symlink `node_modules -> $LIVEMAIN_DEPS` exists at
  the mount root (not logged, not part of the overlay). A virtual read-only file
  `.livemain/inbox` exists (see Notices).
- `clone`: `git clone` (shared objects via `--reference` to the mirror) into
  `$LIVEMAIN_DATA/clones/<id>`, checkout `-b branch sha`, symlink `node_modules`, and
  `.git/info/exclude` gets `node_modules`.

`DELETE /workspaces/:id` → unmount/remove. `{ "ok": true }`

`GET /workspaces/:id` → `{ id, kind, path, sha, generation }`

## File tools (all kinds)

For a `livefs` workspace the file tools resolve paths through the in-process union layer
and record reads exactly like the FUSE handlers do (a FUSE server must not issue syscalls
against its own mount: that can deadlock). External processes (vitest, tsc, node) go
through the kernel mount. Every endpoint is `POST`.

| Endpoint | Body | Result |
|---|---|---|
| `/workspaces/:id/fs/read` | `{ path, offset?: number(line, 1-based), limit?: number(lines) }` | `{ content, totalLines }` (404 `not-found`) |
| `/workspaces/:id/fs/write` | `{ path, content }` | `{ ok: true }` (creates parent dirs) |
| `/workspaces/:id/fs/edit` | `{ path, oldString, newString, replaceAll?: bool }` | `{ ok: true, replacements }`; 409 `no-match` / `ambiguous` |
| `/workspaces/:id/fs/delete` | `{ path }` | `{ ok: true }` |
| `/workspaces/:id/fs/revert` | `{ path }` | `{ ok: true }`: discard this workspace's changes to `path` (livefs: drop the upper copy / whiteout so the pinned base shows; clone: restore from HEAD, or remove if HEAD lacks it) |
| `/workspaces/:id/fs/list` | `{ path: "" | dir, recursive?: bool }` | `{ entries: [{ path, type: "file"|"dir" }] }` (excludes `node_modules`, `.git`, `.livemain`) |
| `/workspaces/:id/fs/grep` | `{ pattern (RE2), path?: dir, glob?: "*.ts", maxResults?: 200 }` | `{ matches: [{ path, line, text }] , truncated }` |

## Tests

`POST /workspaces/:id/test`
```json
{ "files": ["tests/functions/SUM.test.ts"],   // optional; omitted = whole suite
  "timeoutMs": 120000 }
```
Runs `node $LIVEMAIN_DEPS/vitest/vitest.mjs run <files> --reporter=json --outputFile=<tmp>`
with `cwd` = workspace path. The livefs generation is pinned for the duration (an
`advance` that arrives mid-run waits until the run ends).
→ `{ "ok": bool, "passed": n, "failed": n, "files": [{ "file", "ok", "failures": [{ "name", "message" }] }], "output": "<tail 8KB>", "durationMs" }`

### Read sets

`readSet` contains files *opened for reading* (content dependencies). Successful lookups
(stat/exists checks, e.g. vite resolving every lazy registry import target) are kept in a
separate `lookupSet`: counting them as reads would put every function into every test's
read set. At checkpoint, a lookup-only path that was added or deleted upstream produces a
`read-write` notice with severity `review`.

## Live-main checkpoint (livefs only)

`POST /workspaces/:id/checkpoint`
```json
{ "toSha": "<new main sha>" }
```
Steps, atomically with respect to other calls on this workspace:
1. Fetch `toSha` into the mirror if missing.
2. `delta = git diff-tree -r --name-only --no-renames pinSha toSha`.
3. Snapshot `readSet` (files opened through the mount in the current generation, plus
   carried-forward reads) and `writeSet` (paths present in upper or whited-out).
4. For each path in `delta`:
   - in `writeSet` → **write-write**: 3-way merge (base = blob at pinSha, ours = upper,
     theirs = blob at toSha). Order: `mergiraf merge` → additive-union merge (both sides
     only insert lines relative to base; keep both insertions, ours first) → `git merge-file`.
     Clean → rewrite the upper file with the merged result, `mergeResult: "merged"`,
     `mergeMethod`. Conflict → write the conflict-marked file into upper,
     `mergeResult: "conflict"`, severity `interrupt`. Deleted on one side → conflict
     unless the other side is unchanged.
   - else in `readSet` → **read-write**: severity from sigdiff of (blob@pin, blob@to)
     (see "sigdiff CLI"). Missing sigdiff → `review`.
   - else nothing.
5. Swap the lower layer to `toSha`; generation += 1; invalidate kernel caches for every
   path in `delta`; new read set starts empty (reads of paths NOT in `delta` carry forward).
6. Append notices to the inbox.

→
```json
{ "fromSha", "toSha", "generation",
  "delta": ["..."],
  "readSet": ["..."], "writeSet": ["..."],
  "notices": [{ "path", "kind": "write-write"|"read-write", "severity": "interrupt"|"review"|"ignore",
                "reason": "...", "diff": "<unified diff pin→to, max 4KB>",
                "mergeResult": "merged"|"conflict"|null, "mergeMethod": "mergiraf"|"union"|"merge-file"|null }] }
```

`GET /workspaces/:id/overlay`
→ `{ "pinSha", "generation", "readSet": [...], "writeSet": [...],
     "changes": [{ "path", "content": "..."|null }],
     "classes": { "<path>": "none"|"additive"|"body"|"signature" } }`
(`classes` = sigdiff class of each change relative to the pin; omitted paths count as `body`.)
(`changes` = upper files that differ from the lower blob + whiteouts. A file written back to
identical content is not a change.)

`POST /workspaces/:id/readset/reset` → `{ ok }` (testing only)

### Notices / inbox

`GET /workspaces/:id/inbox` → `{ "notices": [...] }` (all since creation).
`POST /workspaces/:id/inbox` `{ notices: [...] }` appends coordinator-originated notices.
The file `.livemain/inbox` in the mount renders the inbox as text (one notice per block).
Reading `.livemain/*` is never logged.

## Clone workspaces: git ops (clone only)

`POST /workspaces/:id/git`
```json
{ "op": "status" | "commit" | "fetch" | "rebase" | "rebase-continue" | "rebase-abort" | "merge" | "push" | "head" | "diff",
  "message"?: "...", "ref"?: "main", "remoteRef"?: "refs/heads/main", "force"?: false }
```
- `commit`: `git add -A && git commit -m message` (no-op OK when clean).
- `fetch`: `git fetch origin <ref>`.
- `rebase`: `git rebase origin/<ref>` → `{ ok, conflicts: [paths] }`.
- `rebase-continue`: `git add -A && GIT_EDITOR=true git rebase --continue`.
- `merge`: `git merge --no-edit origin/<ref>` → `{ ok, conflicts }`.
- `push`: `git push origin HEAD:<remoteRef>` → `{ ok, rejected: bool, sha }`.
- `head`: → `{ sha, branch }`. `status` → `{ clean, conflicts, changed }`. `diff` → `{ diff }`: `git diff origin/<ref>...HEAD` (this branch's changes since the merge base).
Every op returns `{ ok, output }` plus the fields listed.

## Integrator role only

`POST /integrate`
```json
{ "remote": "...",
  "expectedHeadSha": "<sha the coordinator believes is main>",
  "pinSha": "<the overlay's base commit>",
  "changes": [{ "path", "content": "..."|null }],
  "autoMerge": ["registry path", "..."],      // paths in Δ(pin→head) ∩ writeSet the coordinator allows to auto-merge
  "impactTests": ["tests/functions/F.test.ts"],// always run on the merged tree before pushing; any failure aborts
  "impactCandidates": { "src/helpers/criteria.ts": ["tests/functions/SUMIF.test.ts"] },
                                               // run only if that path's class (parent→new) is body|signature
  "message": "promote agent-17: SUM", "author": "agent-17 <agent-17@livemain>" }
```
1. Fetch `expectedHeadSha` and `pinSha`. If remote main != `expectedHeadSha` → 409 `head-moved`.
2. For each change path p:
   - unchanged between pinSha and head → take the overlay content.
   - changed between pinSha and head and p ∈ `autoMerge` → 3-way merge (base=pin, ours=overlay,
     theirs=head) using the same merge chain as checkpoint, AND require sigdiff class of both
     sides (pin→overlay, pin→head) ∈ {none, additive}. Otherwise → 409 `needs-checkpoint` `{ paths }`.
   - changed and not in `autoMerge` → 409 `needs-checkpoint` `{ paths }`.
3. Build the commit on top of `expectedHeadSha` with git plumbing (temporary index, no working tree).
4. Classify every changed path of the new commit vs its parent with sigdiff.
5. Tests to run = `impactTests` ∪ ⋃{ impactCandidates[p] : class(p) ∈ {body, signature} }. If non-empty:
   materialize the new tree into a scratch dir (+ node_modules symlink), run them;
   any failure → 409 `impact-failed` `{ results }` (same shape as `/test`). Nothing is pushed.
6. Push `newSha:refs/heads/main` (non-force). Rejected → 409 `head-moved`.

→ `{ "ok": true, "sha", "parent", "changedPaths": [...], "classes": { "<path>": "none"|"additive"|"body"|"signature" },
     "merged": [{ "path", "method" }], "impact": <test result or null>, "impactRan": [...] }`

`POST /ci`
```json
{ "remote": "...", "sha": "<commit>", "files"?: [...] }
```
Checks out `sha` into a scratch worktree and runs the test suite.
→ same shape as `/test` plus `{ "sha" }`.

`POST /seed` `{ "remote", "dir": "/seed/demo-repo" | "files": { path: content } | "url", "message" }`
→ creates `main` on an empty remote: the directory or the inline files as its root commit, or
the URL's default branch with its history (how repos are created and imported on hosts without
commit creation, like Artifacts). Exactly one source. 409 `already-seeded` if `main` exists. → `{ sha }`

## Gitserver role (local Artifacts stand-in)

Mirrors the subset of the Artifacts control plane we use.

| Endpoint | Body | Result |
|---|---|---|
| `POST /repos` | `{ name }` | creates bare repo `<root>/<name>.git` (`receive.denyNonFastForwards=true`, `http.receivepack=true`) → `{ name, remote: "http://<host>/<name>.git" }` |
| `POST /repos/:name/fork` | `{ name }` | `git clone --bare --shared` → `{ name, remote }` |
| `GET /repos/:name/refs/heads/main` | | `{ sha }` (404 if empty) |
| `GET /repos/:name/file?ref=<sha>&path=<p>` | | raw content (mirrors Artifacts `readFile`) |
| `GET /repos/:name/tree?ref=<ref>` | | `{ ref, entries: [{ path, type: "file"\|"dir", size }] }` (whole tree, recursive) |
| `GET /repos/:name/log?ref=<ref>&path=<p>&max=<n>` | | `{ commits: [{ sha, parents, author, email, at (ms), subject }] }`, newest first |
| `GET /repos/:name/diff?to=<ref>&from=<ref>&path=<p>` | | `{ from, to, patch }` unified diff; `from` defaults to `to`'s parent (the empty tree for a root commit) |
| `POST /repos/:name/init` | `{ files: { path: content }, message }` | first commit of an empty repo → `{ sha }`; 409 `not-empty` otherwise |
| `POST /repos/:name/import` | `{ url }` | fetches the URL's default branch into `main` of an empty repo → `{ sha }`; 409 `not-empty` otherwise |
| `GET/POST /<name>.git/...` | | git smart HTTP via `git http-backend` |

`remote` host is taken from `--public-url` (default `http://gitserver:8090`).

## sigdiff CLI (provided by packages/sigdiff, bundled to `/opt/livemain/sigdiff.cjs`)

`node sigdiff.cjs <oldFile|/dev/null> <newFile|/dev/null> [--path <repo path>]`
prints one JSON line:
```json
{ "class": "none" | "additive" | "body" | "signature",
  "severity": "ignore" | "ignore" | "review" | "interrupt",
  "reason": "human readable, e.g. 'signature of export toNumber changed: (v: Value) => number → (v: Value, opts: CoerceOpts) => number'",
  "symbols": { "added": [...], "removed": [...], "bodyChanged": [...], "signatureChanged": [...] } }
```
`class` ordering: none < additive < body < signature. severity: none/additive → ignore, body → review,
signature → interrupt. Exit code 0 even for changes; non-zero only on internal error (callers treat as `body`/`review`).
Also usable as a long-running server: `node sigdiff.cjs --serve` reads JSON lines `{"old":"<text>|null","new":"<text>|null","path":"..."}`
on stdin and writes one result JSON line per request (preferred by the Go side to avoid process start cost).
