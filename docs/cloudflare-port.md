# Porting API v1 to Cloudflare

Today `/v1` (packages/api) runs only inside `livemain serve`: one Node process holding every
repository's coordinator, every running swarm and every live connection in memory, with
Docker containers as workcells and a local git server standing in for Artifacts. The
Cloudflare app (`apps/edge`) already runs the *core* (coordinator, agents, workcell
containers, run orchestration) but only for benchmark runs, not the product API.

Decided: one API, two platforms. `packages/api` stays the single implementation; the local
runtime stays the development and self-host path; Cloudflare gets a second `Platform`.

## What already exists on the edge

| Piece | Status |
|---|---|
| Coordinator in a Durable Object (`CoordinatorDO`, DO SQLite via `do-sql.ts`) | runs the same `Coordinator` class |
| Workcell containers (`Workcell` container DO, FUSE, `LIVEMAIN_ROLE`) | verified under `wrangler dev` |
| Agents as alarm-sliced DOs (`SwarmAgentDO`: LLM loop resumes across 15-minute alarms) | verified for runs |
| Run orchestration (`RunDO`: scheduler snapshot/restore, tick alarms, serialized reports) | verified for runs |
| WebSocket fan-out with hibernation (`CoordinatorDO.acceptWebSocket`) | verified |
| Artifacts as the git host for API v1 (`ArtifactsGitHost`: binding typings from `wrangler types`) | verified against the real service (Oct 3, 2026) |

## What the port requires

1. **Split the service along Durable Object boundaries.** `ApiService` assumes one process:
   one metadata DB with every repo's tasks, agents and landings keyed by `repo_id`, plus
   in-memory maps of coordinators, running swarms and subscribers. A DO owns one database
   and one thread, so the service splits in two:
   - **OrgService → `OrgDO`** (one per org): repository index, model keys, members and
     budgets (with accounts, see `docs/accounts-plan.md`).
   - **RepoService → `RepoDO`** (one per repository): the coordinator, that repo's tasks,
     swarms, agents, landings, agent log, CI state, and its live connections.
   The local runtime keeps hosting both in one process, so this refactor lands first and is
   tested locally before any Cloudflare code changes.

2. **Swarms become state machines, not promises.** Locally `SwarmRun` is a long-lived loop
   that awaits agents for minutes. On Cloudflare a request cannot hold that, so the swarm runner
   becomes a port with two implementations: in-process (today) and DO-driven (generalizing
   `RunDO`): the scheduler snapshot lives in storage, a tick alarm launches agents into
   `AgentDO`s, agents report their outcome by RPC, and pause/stop/budget are messages. An
   agent's `AbortSignal` becomes a stop flag the `AgentDO` checks at each tool call and slice.

3. **Agents reach the coordinator by RPC.** Locally agents call it in-process; on the edge
   `AgentDO → RepoDO` RPC (the runs code already does this over HTTP to `CoordinatorDO`).

4. **Live updates over hibernating WebSockets.** Server-sent events keep a DO awake for the
   whole connection. `RepoDO` uses the WebSocket hibernation API (as `CoordinatorDO` does),
   and the web client gets a transport switch (WebSocket on both runtimes; the local server
   already speaks WebSocket).

5. **A git host that can browse, not just store.** The Artifacts binding now covers most of
   `GitHost`: `import` (URL import), `log` (first-parent history), `readTree` (one directory
   level, which suits a lazily expanded file tree), `readCommit`, `readBlob`, `readFile`, and
   repo-scoped git tokens (`createToken`, `revokeToken`). Two things are missing: diffs, which
   the Worker computes from two trees with the jsdiff code `packages/api` already uses, and
   an initial commit for an empty repo, which the integrator container pushes. Our
   `ArtifactsBinding` typings need extending to the full binding.

6. **Git push through Live Main.** For a GitHub replacement, `git push` is a primary path, not
   an afterthought. A smart-HTTP gateway Worker authenticates the pusher, receives the pack,
   and turns a push to `main` into a landing through the coordinator (same promotion rule,
   notices and impact tests) instead of moving the ref directly. Pushes to other branches go
   straight to Artifacts. (Locally the same gateway replaces direct pushes to the git server.)

7. **Containers per org.** Workcells are addressed as `${org}:wc:${i}` and integrators as
   `${org}:integrator`, never shared across orgs; they scale to zero when idle
   (`sleepAfter`). Instance type and pool size come from the org's plan.

8. **Small replacements.** The CI loop's timer becomes a `RepoDO` alarm. Template tasks and
   reference solutions are served from Worker assets (the runs code already does this). The
   key vault already uses WebCrypto; the key-encryption key becomes a Worker secret with a
   per-org data key. The web app is served as static assets with single-page fallback and
   `/v1` routed to the Worker first.

9. **Accounts before anything is public.** Every `/v1` call needs a principal and an org; see
   `docs/accounts-plan.md`.

10. **Limits to design for.** One `RepoDO` is single-threaded: at 100 agents, step events
    reach tens per second, so events are written in batches and broadcast coalesced. DO
    storage is ample (10 GB) and memory is 128 MB, so agent logs are capped per agent and
    old logs move to R2.

## Phases

| Phase | Work | Gate | Size |
|---|---|---|---|
| C1 | Split `ApiService` into `OrgService` + `RepoService`; swarm runner as a port; WebSocket transport. Local only. | all API and web tests pass locally; `livemain serve` unchanged for the user | M |
| C2 | `RepoDO` + `OrgDO` platform; DO swarm runner from `RunDO`; agents by RPC; vitest-pool-workers tests | a 10-task replay swarm lands under `wrangler dev` with the coordinator-only config (synthetic integrator) | L |
| C3 | Browse endpoints in the integrator role; `GitHost` on Artifacts + integrator; per-org containers | create, browse, dispatch and land on deployed Cloudflare with Artifacts | M |
| C4 | Push gateway (smart HTTP → landing), locally and on the edge | a human `git push` to main lands with notices to agents that read the changed files | M |
| C5 | Accounts wired in (A3 of the accounts plan), deploy, load test | 10 orgs × 20 agents concurrently; isolation tests pass; cost per landing measured | M |

Prerequisites: a Cloudflare account on the Workers Paid plan ($5/month; it includes
Containers and Artifacts, which is in open beta and starts billing on Oct 14, 2026), and a
domain. Full end-to-end runs need deployed Cloudflare or a Linux amd64 machine: `wrangler dev`
builds amd64 containers, and FUSE is unreliable under emulation on Apple Silicon.

## Status (Oct 2, 2026)

**C1 done.** `packages/api` is split into `OrgService` (repo index, keys) and `RepoService`
(coordinator, tasks, swarms, agents, landings, CI; its own database), reached through a
`RepoHost` port; swarm and agent routes are repo-scoped; the swarm runner is a port with an
in-process and a durable implementation; live updates are WebSockets (with resync after a
reconnect). The local runtime (`LocalApi`) runs both in one process.

**C2 done (on `wrangler dev`).** `apps/edge` hosts API v1 on Durable Objects: `OrgDO`,
`RepoDO` (RepoService on DO SQLite, hibernating WebSocket events, a durable swarm runner whose
scheduler state lives in SQL and is advanced by alarms) and `RepoAgentDO` (one agent, alarm
slices, reports back by RPC). The Worker routes `/v1/repos/:owner/:name/*` to the repo's
object, the rest of `/v1` to the org, and serves the web app. Verified: create a template
repo, dispatch, land 10/10 and 8/8 swarms, live updates in the browser served by the Worker,
pause/resume/stop with agents mid-flight, budget/time caps through the same runner.

Development config: `wrangler.dev.jsonc` runs the real Worker and Durable Objects with the
git server, integrator and workcells as plain HTTP servers (the native Docker stack), which
works on macOS and is also the shape for running workcells on any Linux server.

**C3 done (verified against real Artifacts, Oct 3, 2026).** `ArtifactsGitHost` (`packages/api/src/artifacts-host.ts`)
implements `GitHost` on the binding, and the edge uses it whenever `ARTIFACTS` is bound:

- *Create:* `create(name, {setDefaultBranch: 'main'})`, then a write token valid for a year
  for the workcells and integrator (the creation token is revoked). People get `cloneUrl`
  without credentials and `POST /v1/repos/:o/:n/clone-access` for a one-hour read token
  (Settings → Clone in the web app).
- *First commit and import:* Artifacts cannot create commits, so the integrator's `/seed`
  now takes inline files or a URL as well as an image directory, and pushes `main` with a
  one-hour write token. Imports go through the same path (the URL's default branch becomes
  `main`, as on the local git server) instead of `ARTIFACTS.import`, which would keep a
  `master` default branch.
- *Browse:* the full tree is a walk of `readTree` (one level per call; trees and commits are
  content-addressed, so they are cached per instance); files are `readFile`; history is `log`.
- *Diffs:* computed in the Worker from two trees, descending only into subtrees whose hashes
  differ, and formatted as git-style patches with jsdiff (`unifiedPatch`). Binary and
  too-large blobs are marked, not diffed.
- *Path history:* `log` has no path filter, so the file view now finds a file's last landing
  in the `landings` table (every change to main is a landing) instead of a path-filtered git
  log; the host's path filter scans at most 200 commits.

Artifacts has **no local simulator** (wrangler treats it as remote-only).
`wrangler.dev-artifacts.jsonc` runs the Worker and Durable Objects locally against the real
service (namespace `live-main-dev`, created with its first repo) with the Docker workcells and
integrator cloning from and pushing to it. Verified on Oct 3, 2026:

- an empty repo: created and seeded with its README in 7.5 s; tree, file, landing diff;
- the clone-access URL clones with `git clone`, and its read token is refused on push (403);
- the formula-engine template: seeded from the image in 6 s; a 10-task scripted swarm landed
  10/10 in about a minute (concurrent `registry.ts` edits merged by mergiraf), CI 118/118 on
  the head; overlays appear as `refs/heads/overlay/*` branches; a landing's diff is computed
  from Artifacts trees in about 0.6 s and the full 407-entry tree is listed in about 0.5 s;
- an import of `github.com/octocat/Hello-World` (default branch `master`) became `main` with
  its history.

**Next:** deploy with Containers (workcells and integrator as Container Durable Objects), behind
access control: hosted mode has no accounts yet, so a public Worker would let anyone dispatch
swarms on the stored model keys.
