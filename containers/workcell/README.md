# workcell

One Go binary (`workcell`, module `livemain/workcell`) and one Linux image that implement
the HTTP contract in [`docs/workcell-api.md`](../../docs/workcell-api.md) in three roles:

| Role | Command | What it does |
|---|---|---|
| workcell | `workcell serve --listen :8080` (`--role workcell` is the default) | agent workspaces: FUSE `livefs` mounts or plain git clones, file tools, vitest runs, checkpoints, overlays, inboxes, git ops |
| integrator | `workcell serve --listen :8080 --role integrator` | everything above plus `/integrate`, `/ci`, `/seed`; the only writer of `refs/heads/main` |
| gitserver | `workcell serve-git --listen :8090 --root /srv/git --public-url http://gitserver:8090` | local Artifacts stand-in: bare repos over git smart HTTP (`git http-backend` via `net/http/cgi`) plus `POST /repos`, `POST /repos/:name/fork`, `GET /repos/:name/refs/heads/main`, `GET /repos/:name/file`, `GET /health` |

## Architecture

```
cmd/workcell            flags, roles, wiring, graceful shutdown (unmounts every workspace)
internal/gitstore       git CLI wrapper; shared bare mirror; persistent `git cat-file --batch`;
                        per-commit path index from `git ls-tree -r -t -l -z`; blob LRU; diff-tree
internal/livefs         union.go: FUSE-independent union semantics (testable anywhere)
                        fuse.go: go-fuse/v2 `fs` adapter, generation swap + kernel invalidation
internal/workspace      workspace manager: create/delete, file tools, tests, checkpoint,
                        overlay, inbox, clone git ops
internal/merge          merge chain: mergiraf → additive union (own code) → git merge-file
internal/sigdiff        client for `node sigdiff.cjs --serve` (one long-lived process, id-matched)
internal/integrator     /integrate (plumbing commit with a temp index), /ci, /seed
internal/gitserver      serve-git role
internal/testrun        vitest runner (JSON reporter) + result normalization
internal/api            HTTP routing, structured JSON errors, request logging, panic recovery
internal/apierr         `{"error": code, "message": ...}` error type and JSON helpers
```

### livefs

Per workspace, a FUSE mount at `$LIVEMAIN_DATA/mnt/<id>`:

- **Lower**: the git tree of the pinned commit, read directly from the shared bare mirror
  (`$LIVEMAIN_DATA/mirror.git`). No checkout. Paths resolve through an immutable per-commit
  index (`ls-tree`); blob bytes come from one persistent `cat-file --batch` process per mirror
  (with a 256 MiB LRU). Mtimes are synthetic: the workspace creation time, bumped for paths
  (and their ancestors) that change in a swap.
- **Upper**: a plain directory `$LIVEMAIN_DATA/upper/<id>`. Copy-up on open-for-write,
  truncate and chmod. Whiteouts are kept in memory: a whiteout at `p` hides the lower layer at
  `p` and below, so deleting a lower directory and recreating it makes it opaque.
  Rename = copy-up (whole merged subtree for directories) + whiteout of the source.
  Supported: lookup, getattr/setattr (size, mode, times), open/create, read/write, mkdir,
  rmdir, unlink, rename (incl. `RENAME_NOREPLACE`), symlink/readlink, readdir, statfs.
- **Virtual entries**: `node_modules` at the root is a symlink to `$LIVEMAIN_DEPS`;
  `.livemain/inbox` is a read-only rendering of the inbox. Neither is ever part of the
  overlay or the read set; both names are reserved for writes.
- **Read logging** per generation, never for `node_modules/**`, `.git/**`, `.livemain/**`:
  - `readSet`: regular files opened for reading (`O_RDONLY` or `O_RDWR`).
  - `lookupSet`: regular files successfully looked up but never opened (see Deviations).
  - `readdirSet`: directories listed.
  Readdirplus is disabled so listing a directory never looks up (logs) its entries.
- **Generation swap** (`Mount.Advance`): under the union's write lock the lower index pointer
  is swapped and the generation bumped; then, outside any lock, the kernel caches for every
  delta path are invalidated (`NotifyEntry` on each path component, `NotifyContent` on every
  cached inode along the path). Each non-directory path carries a *version* (the generation
  in which it last changed) that is hashed into its inode number, so a changed file gets a
  fresh kernel inode: new opens and stats see the new blob immediately, while handles opened
  earlier stay on the old inode, keep their own page cache and keep reading the blob they
  opened (`dataFile` holds the bytes). That makes `FOPEN_KEEP_CACHE` safe for all files
  (lower content per inode is immutable; upper files only change through the mount, or in a
  checkpoint, which bumps the version). Entry/attr/negative TTL is 1 s
  (`LIVEMAIN_FUSE_TIMEOUT`) as a safety net on top of explicit invalidation.
- Reads of paths not in the delta carry forward into the new generation's sets.

### Locking

- `Workspace.apiMu` (RWMutex): checkpoint and delete hold it exclusively; every other call,
  including an entire test run, holds it shared. A checkpoint (the advance) therefore waits for
  in-flight test runs, and test runs see one generation from start to finish.
- `Workspace.fsMu`: serializes mutating file tools and git ops.
- `Union.mu` (RWMutex): FUSE handlers take it shared (mutations exclusively, briefly); the
  read-set lock is nested inside it so a swap and a concurrent lookup can't misattribute a read
  to the wrong generation. Kernel notifications are sent with no lock held.
- Integrator: one mutex serializes `/integrate` and `/seed`; the non-force push is the
  compare-and-swap against concurrent writers.

### Checkpoint (`POST /workspaces/:id/checkpoint`)

Fetch `toSha` into the mirror → `delta = diff-tree pin..to` → snapshot read/write/lookup sets →
classify each delta path → apply overlay rewrites → swap (+ invalidation) → append notices.

- write-write: base = blob@pin, ours = upper (or whiteout), theirs = blob@to. Trivial cases
  (identical change, overlay unchanged, both deleted) resolve without a tool; otherwise the
  chain runs: `mergiraf merge base ours theirs -p <repo path> -o out` (real extension so the
  TS grammar is used) → additive union (both sides only insert lines; ours first at a shared
  anchor; an identical block inserted by both is kept once) → `git merge-file --diff3`.
  Clean → upper rewritten (or dropped if equal to the new lower). Conflict → conflict-marked
  file written to upper, severity `interrupt`. Delete vs. modify → conflict.
- read-write: sigdiff of (blob@pin, blob@to).
- All merges are computed before the upper layer is touched, so a failing checkpoint leaves
  the workspace as it was.

### Integrator (`POST /integrate`)

`ls-remote` check against `expectedHeadSha` → fetch pin and head → per change path: take the
overlay if the path didn't move since the pin; auto-merge it if it's in `autoMerge`, both sides
classify as `none`/`additive` and the merge chain is clean; otherwise `needs-checkpoint` →
commit built with plumbing (`read-tree` into a temp `GIT_INDEX_FILE`, `hash-object -w`,
`update-index --index-info`, `write-tree`, `commit-tree -p head`) → sigdiff class of every
changed path vs the parent → impact tests = `impactTests` ∪ `impactCandidates[p]` for every
`body`/`signature` path, run on the tree extracted with `git archive` into a scratch dir
(+ `node_modules` symlink) → non-force `git push <sha>:refs/heads/main` (rejection →
`head-moved`).

## Build, run, test

```sh
# image (build context = repo root)
docker build -f containers/workcell/Dockerfile -t livemain-workcell .
#   --build-arg DEPS_DIR=containers/workcell/testdata/deps         if demo-repo/package-lock.json is missing
#   --build-arg DEMO_DIR=containers/workcell/testdata/fixture-repo if demo-repo/ is missing

# run (FUSE needs the device + SYS_ADMIN; apparmor:unconfined on Docker Desktop/Ubuntu)
docker network create lm
docker run -d --name gitserver --network lm -p 8090:8090 livemain-workcell \
  serve-git --listen :8090 --root /srv/git --public-url http://gitserver:8090
docker run -d --name integrator --network lm -p 8081:8080 \
  --device /dev/fuse --cap-add SYS_ADMIN --security-opt apparmor:unconfined \
  livemain-workcell serve --listen :8080 --role integrator
docker run -d --name workcell --network lm -p 8080:8080 \
  --device /dev/fuse --cap-add SYS_ADMIN --security-opt apparmor:unconfined \
  livemain-workcell serve --listen :8080
curl -XPOST localhost:8090/repos -d '{"name":"main"}'
curl -XPOST localhost:8081/seed -d '{"remote":"http://gitserver:8090/main.git","dir":"/seed/demo-repo","message":"seed"}'

# Go unit tests (macOS or Linux; FUSE tests skip without /dev/fuse)
cd containers/workcell && go vet ./... && go test ./...
# Go unit tests including FUSE, inside Docker
docker build -f containers/workcell/Dockerfile --target test -t livemain-workcell:test .
docker run --rm --device /dev/fuse --cap-add SYS_ADMIN --security-opt apparmor:unconfined livemain-workcell:test

# full integration suite: build, unit tests in Docker, 3 containers, scenarios, overhead
containers/workcell/scripts/itest.sh
#   SKIP_BUILD=1 SKIP_UNIT=1 SKIP_DEMO=1 KEEP=1 ITEST_OVERHEAD_RUNS=3 WORKCELL_ENV="LIVEMAIN_FUSE_TIMEOUT=5s"
```

The image: Go build stage → mergiraf 0.20.0 release binary from codeberg (linux arm64/amd64,
verified with `--version` at build) → `npm ci` of `$DEPS_DIR/package{,-lock}.json` into
`/deps` → `node:20-bookworm-slim` runtime with git, fuse3, ca-certificates. It ships
`/opt/livemain/sigdiff.cjs` (copied from `packages/sigdiff/dist` when present) and
`/opt/livemain/sigdiff-stub.cjs`, and the seed sources `/seed/demo-repo` and `/seed/fixture-repo`.

| Env | Default | |
|---|---|---|
| `LIVEMAIN_DATA` | `/var/livemain` | mirror, uppers, mounts, clones, caches, scratch |
| `LIVEMAIN_DEPS` | `/deps/node_modules` | target of the virtual `node_modules` |
| `LIVEMAIN_SIGDIFF` | `/opt/livemain/sigdiff.cjs` | missing → every severity is `review`, class `body` |
| `LIVEMAIN_MERGIRAF` | `mergiraf` on PATH | missing → chain starts at the union merge |
| `LIVEMAIN_FUSE_TIMEOUT` | `1s` | kernel entry/attr/negative TTL |
| `LIVEMAIN_FUSE_DIRECTIO` | off | `1` disables the kernel page cache for file handles |
| `LIVEMAIN_FUSE_DEBUG` | off | `1` logs every FUSE request |

## Tests

- Unit (`go test ./...`): path index from `ls-tree`, cat-file after new packs, diff-tree,
  author parsing (gitstore); union merge incl. anchors/dedup/no-newline, merge chain fallbacks,
  mergiraf when installed (merge); union semantics without FUSE: virtual entries, read/lookup/
  readdir logging and ignore rules, copy-up, whiteouts, opaque recreate, rename (file, mixed
  dir, NOREPLACE, overwrite), truncate/chmod, advance carry-forward, overlay changes (livefs);
  FUSE (Linux): reads + read set, readdir not polluting sets, writes in upper only, append,
  delete, rename, swap with immediate visibility + open handle keeps old blob, 16 concurrent
  writers; sigdiff client vs stub and fallback; vitest report parsing; integrator end to end
  against a local bare repo (success, head-moved, needs-checkpoint, autoMerge, non-additive
  refusal, no-op) and seed.
- Integration (`scripts/itest.sh`, Go driver in `itest/`, build tag `itest`): gitserver +
  integrator + workcell on a docker network; seeds `testdata/fixture-repo` (lazy registry,
  SUM/AVERAGE/CONCAT implemented, MAX/MIN tests failing) and exercises: workspace create, read
  via mount lands in the read set (inbox/node_modules never), windowed read, list, grep,
  writes land in upper only, edit no-match/ambiguous, reserved paths, vitest on the mount
  through the virtual `node_modules` (read set of a single-function test excludes unrelated
  functions), delete/whiteout incl. directory delete and recreate, the worked example,
  open handle across a swap, write-write conflict, `/integrate` head-moved / impact-failed /
  autoMerge, clone git ops incl. rejected push, rebase conflict, abort, continue, merge, and
  `/ci`; then measures FUSE overhead.

Worked example (asserted in `worked_example_C_A_B`): agents A, B, C pinned at v1. C changes
the signature of `toNumber` in `value.ts`; A adds MAX and B adds MIN (registry line + file);
all three run their tests (A and B read `value.ts`). Promotions land C, A, B:

| Step | Result asserted |
|---|---|
| C promotes (v1→v2) | `classes[value.ts] = signature`; its impact candidates (SUM, AVERAGE tests) run green before the push |
| A checkpoints v1→v2 | delta = {value.ts}; one notice: read-write, `interrupt`; inbox file shows it; A sees v2 content |
| A promotes (v2→v3) | registry and MAX.ts classify `additive`; registry impact candidates are *not* run |
| B promotes at pin v1 | 409 `needs-checkpoint` `{paths: [registry.ts]}` |
| B checkpoints v1→v3 | delta = {value.ts, registry.ts, MAX.ts}; value.ts read-write `interrupt`; registry write-write `merged` via mergiraf, severity `ignore`; no notice for MAX.ts; MAX and MIN tests green |
| B promotes (v3→v4) | main has all five registry entries; `/ci` on v4: 13/13 green |

## Measured FUSE overhead

Inside the workcell container on Docker Desktop (Apple Silicon, linuxkit VM),
`node /deps/node_modules/vitest/vitest.mjs run` on the livefs mount vs a plain `git archive`
checkout with the same `node_modules` symlink; one warm-up each, then 10 alternating runs
(`ITEST_OVERHEAD_RUNS`). Other workloads were running on the host, so absolute numbers are noisy.

| Workload | run 1: mount / plain (median) | overhead | run 2 (final code): mount / plain | overhead |
|---|---|---|---|---|
| fixture, full suite (6 test files) | 558 / 533 ms | +4.7 % | 534 / 520 ms | +2.6 % |
| fixture, single test (SUM) | 490 / 481 ms | +1.8 % | 522 / 494 ms | +5.7 % |
| demo-repo, full suite (in-progress repo, 329 / 382 files) | 4506 / 3752 ms | +20.1 % | 5806 / 4865 ms | +19.3 % |
| demo-repo, single test (SUM) | 527 / 523 ms | +0.8 % | 866 / 729 ms | +18.7 % |

Run 2 was taken while other heavy jobs shared the machine (note the plain-checkout times
rising too, and an 18 s outlier on the mount side); the full-suite overhead is consistently
about 20 %, under the 30 % gate in PLAN.md; small runs are within noise.

Read set of one single-function test: 8 of 20 files (fixture), 12 of 382 files (demo repo, final run).
The first design (`FOPEN_DIRECT_IO`, path-only inode numbers) measured +45 % on the demo
full suite; version-in-inode + `FOPEN_KEEP_CACHE` + symlink caching brought it to the numbers
above. A 30 s kernel TTL made no measurable difference, so the default stays at 1 s.

## Deviations from the contract

1. **Lookups are not in `readSet`.** `readSet` is "files opened through the mount" (the
   contract's wording). Successful lookups of regular files are recorded too, but in a
   separate `lookupSet` (returned by `/overlay` and `/checkpoint`). Reason: vite resolves
   (stats) every target of the lazy registry's `import()` calls while transforming
   `registry.ts`, without opening them, so counting lookups as reads put every registered
   function into every test's read set and would make promote-without-retest impossible.
   A stat-only dependency is an existence dependency: at checkpoint, a delta path that is
   only in `lookupSet` yields a `read-write` notice with severity `review` when it was added
   or deleted (its content changing doesn't matter, since content dependencies always open).
2. **Extra response fields** (additive): `/overlay` adds `lookupSet`, `readdirSet` and
   `classes` (sigdiff class of each change vs the pin, as requested; omitted per path when
   sigdiff is unavailable); `/checkpoint` adds `lookupSet`; notices add `generation`,
   `fromSha`, `toSha`; `head-moved` errors carry `headSha`; `impact-failed` carries
   `results` and `impactRan`; `edit` `ambiguous` carries `count`; `GET /workspaces` lists all.
3. **Merged write-write severity** (unspecified): the sigdiff severity of the upstream change
   (blob@pin → blob@to), i.e. what changed under the agent. Trivial resolutions (identical
   change, overlay unchanged, deleted on both sides) report `mergeResult: "merged"`,
   `mergeMethod: null` and drop the overlay copy.
4. `/integrate` whose changes leave main's tree unchanged returns `ok` with
   `sha == expectedHeadSha` and empty `changedPaths` (nothing pushed).
5. `/seed` when main already exists → 409 `already-seeded` `{sha}`.
   `POST /repos` is idempotent; forking onto an existing name → 409 `exists`.
6. `/ci` and impact tests extract the tree with `git archive` into a scratch dir rather than
   `git worktree add` (same effect, no worktree bookkeeping in the bare mirror).
7. `POST /workspaces` with `sha` omitted pins the remote's current `main`.
8. Clone git ops: expected failures (rejected push, rebase/merge conflicts) are HTTP 200 with
   `ok: false`. `diff` is `git diff origin/<ref>...HEAD` (committed branch changes since the
   merge base), per the coordinator's request.
9. `fs/edit` with an empty `oldString` → 400. Writes to `node_modules/**`, `.git/**`,
   `.livemain/**` → 400 `reserved-path`. Reading a directory → 400 `is-directory`.

Error codes used: `bad-request`, `not-found`, `exists`, `is-directory`, `reserved-path`,
`forbidden`, `no-match`, `ambiguous`, `mount-failed`, `fetch-failed`, `clone-failed`,
`remote-error`, `head-moved`, `needs-checkpoint`, `impact-failed`, `push-failed`,
`already-seeded`, `timeout`, `internal`.

## No syscalls against our own mount

A FUSE server that issues syscalls against its own mount can deadlock: the kernel waits
for the server, and the server waits for itself. Two places used to do that, and both hung
reliably when the amd64 image ran under CPU emulation on an arm64 host (the `wrangler dev`
setup on Apple Silicon):

- **File tools** (`fs/read`, `fs/write`, `fs/edit`, `fs/list`, `fs/grep`, `fs/delete`)
  now call the union in process (`internal/workspace/fsbackend.go`). Reads are recorded
  the same way the FUSE handlers record them, and writes invalidate the kernel's caches
  for the touched paths.
- **Test runs** start `node` via `sh -c 'cd <mount> && exec …'`. With `cmd.Dir`, the
  forked child `chdir`s into the mount before `exec`, while the parent is paused.

External processes (vitest, tsc) still go through the kernel mount, which is what
produces the read set for builds and tests.

Two more FUSE hazards, found by the swap stress test (`internal/livefs/posix_test.go`):

- **Fork while holding an fd on our own mount.** A forked child's pre-`exec` `dup3`/`close`
  of an inherited fd on the mount sends FLUSH to this very server, which can deadlock
  against a stop-the-world GC waiting on the forking thread. The server never opens files
  on its own mounts, except go-fuse's brief open during mount setup; `MountUnion` holds
  `syscall.ForkLock` across that window (with strict direct mounting, so nothing forks
  under the lock).
- **Interrupted requests.** The kernel sends FUSE INTERRUPT whenever the calling thread
  gets a signal (including Go's preemption signal). Local blob reads ignore request
  cancellation, so an interrupted `open` no longer fails with EIO.

## Known limitations

- Workspaces live in memory: a process restart drops them (stale mounts, uppers, clones and
  caches are cleaned on start; the mirror persists). Whiteouts are in memory only.
- Test runs are isolated per workspace (a uid derived from the workspace, 20000–49999; disable
  with `LIVEMAIN_ISOLATE=0`). The server itself runs as root (FUSE mounts, git), and the
  shared `/deps/node_modules/.vite-temp` is world-writable (sticky) for vite.
- Overlay `changes` carry text content only: symlinks and file-mode changes are not
  represented; content is assumed UTF-8 (the demo repo is text only).
- Hard links and `RENAME_EXCHANGE` are not supported; xattrs are disabled.
- `fs/grep` opens every file it scans, so a repo-wide grep puts those files in the read set
  (conservative: a grep result depends on their contents).
- After `POST /readset/reset` (testing only) a path stat'ed again within the 1 s TTL is
  served from the kernel cache and not re-logged; opens are always logged.
- Upper files are assumed to change only through the mount or a checkpoint (the page-cache
  safety argument above); editing `$LIVEMAIN_DATA/upper` by hand needs a remount.
- A checkpoint fails as a whole (nothing changed) if any merge errors, but a crash between
  rewriting upper files and the swap could leave merged content over the old lower layer.
- The sigdiff process and the `cat-file` process are shared and serialized per workcell.
- Vite writes its temporary bundled config into `/deps/node_modules/.vite-temp`, so `/deps`
  must stay writable for the test runner.
