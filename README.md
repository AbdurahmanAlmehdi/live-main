# Live Main

**Version control for agent swarms.** One shared live `main`. Each agent works in a thin
copy-on-write overlay on it. The base advances at the agent's checkpoints, and the
filesystem itself tells the agent what moved under it. "Merging" is just promoting an
overlay into the base.

Built on Cloudflare: Artifacts (git storage), Durable Objects (coordinator, agents, runs),
Containers (FUSE overlays, builds, tests) and Workers (API, dashboard).

<!-- RESULTS -->
## Results (scripted agents, full bank: 336 tasks, 16 agents on 4 workcells, seed 1)

Same tasks, scheduler, agent loop and test runner; only version control differs. Measured on
one shared (and otherwise busy) laptop, so wall times are relative, not absolute.

| metric | live-main | pr-flow | push-to-branch |
|---|---|---|---|
| landed / failed | **336 / 0** | 252 / 81 | 262 / 69 |
| wall time | **25.6 min** | 79.4 min | 50.9 min |
| time to all-green | **19.8 min** | never | never |
| throughput (landings/min) | **13.1** | 3.2 | 5.1 |
| wasted agent-minutes | **26.7 (9%)** | 1113.0 (93%) | 708.4 (92%) |
| rebases (conflicted files) | **0 (0)** | 2215 (1894) | 2912 (2836) |
| auto-merged files | 257 | 0 | 0 |
| breakages caught before landing | **30** | 0 | 0 |
| breakages that landed (regressions) | 1\* | 28 | 30 |
| final CI (tests passed / failed) | **2086 / 0** | 1492 / 586 | 1562 / 524 |

Smaller runs (60 tasks, 8 agents on 3 workcells), seeds 2 and 3:

| metric | live-main | pr-flow | push-to-branch |
|---|---|---|---|
| landed | **60, 60** | 53, 53 | 57, 57 |
| wall time (min) | **3.9, 4.6** | 12.3, 12.5 | 10.7, 10.5 |
| breakages caught / landed | **9 / 0, 11 / 0** | 0 / 4, 0 / 4 | 0 / 6, 0 / 6 |
| final CI failed tests | **0, 0** | 38, 38 | 37, 37 |

\* a one-off CI flake under load (UNICHAR red at v174, green at the next run; only additive
changes in between). The baselines' failures are the merge race: 16 agents append to the
same function registry, so a rebase conflicts again before the re-test (pr-flow) or the
push (push-to-branch) finishes; each agent gets 25 merge attempts. Their landed breakages
are the traps: nothing re-runs the tests of code already on main before merging. Full
scoreboards: `bench/results/` (event logs per run land in `bench/runs/`); reproduce with
`scripts/bench-suite.sh` (logs in `bench/runs/suite-*.log`) or `pnpm livemain compare`.

## Why

Run hundreds of agents through the GitHub flow (branch → PR → review → merge) and
throughput collapses:

- **Late detection**: an agent learns its context is stale only at merge time.
- **Expensive re-application**: a rebase forces re-understanding a text diff.
- **The race**: after rebasing, someone else lands first. Retry, repeat.
- **Read-write staleness is invisible to git**: A reads how `coerce.ts` works, B changes
  `coerce.ts`, both merge cleanly, A's code is now wrong. Only tests catch it, if they do.

## How it works

```
            ┌──────────────── Workers (API, dashboard, agent tools) ────────────────┐
  Agent DO ×N  (Haiku loop, tools)        Coordinator DO (single writer of "main")  │
     │  tool calls                          • version clock  v1, v2, …              │
     ▼                                      • overlay registry (agent → pin, files)  │
  Workcell container ×M  ◄──── control ───► • read-set index  (path → agents)       │
   ├─ livefs (Go, FUSE)                     • promotion queue + change-order lane   │
   │   /mnt/agent-k = commit(pin) ∪ upper_k   • notices (WebSocket, hibernation)     │
   │   logs open/lookup → read set           └──────────────┬────────────────────────┘
   ├─ shared git mirror of main                             │ push (fast-forward only)
   └─ mergiraf, sigdiff                                     ▼
                                          Artifacts: main repo (+ git-compatible history)
```

1. **Overlay on a pinned main.** `livefs` mounts `git tree @ pin ∪ upper dir` per agent
   (whiteouts for deletes). Editors, the compiler and the test runner see a normal
   checkout. Every file they open is logged: the **read set** comes for free, including
   transitive imports opened by the compiler and the tests.
2. **Checkpoints advance the view.** Before each test run, every N tool calls and on
   interrupts, the agent's view swaps atomically to the latest main (open file handles keep
   their old version). Each changed path is classified:

   | changed path is… | result |
   |---|---|
   | in the overlay (write-write) | entity-level merge (mergiraf → additive-union → git merge-file); notify only on conflict |
   | in the read set (read-write) | notice with diff; severity from **sigdiff**: signature change = interrupt, body = review, formatting/additive = ignore |
   | neither | nothing |
3. **Promotion is the merge.** With Δ = paths changed on main since the pin:
   - Δ ∩ writes, all additive (e.g. two registry entries) → auto-merged by the integrator
   - Δ ∩ writes, otherwise → stale: checkpoint and re-test
   - Δ ∩ reads with body/signature changes → stale: checkpoint and re-test
   - otherwise → **land without re-running the agent's tests**, after running the landed
     tests whose recorded read sets touch a non-additive change (test-impact analysis from
     the FUSE read sets). A change that would silently break code already on main is
     rejected *before* it lands.
4. **Change orders** (contract changes) jump the promotion queue, and every agent whose
   read set touches them gets an interrupt.
5. **Planner**: load-bearing = transitive import fan-in × churn. Files whose history is
   append-only per sigdiff (registries, barrels, route tables) are hot spots, not
   contracts. Contract tasks land before the features that depend on them.
6. **Generated files are regenerated, never text-merged**: lockfiles and paths marked
   `linguist-generated` in `.gitattributes` take main's version on conflict, and
   `scripts/livemain-regen` (if the repo has one) runs on the merged tree before landing.

Every promotion is a real git commit on the Artifacts repo, so `git clone` always works.
Each agent's work in progress is also git: its overlay is published as a fast-forward-only
ref after green tests and checkpoints (a per-agent Artifacts fork on Cloudflare,
`refs/heads/overlay/<agent>` locally), so you can `git fetch` any agent's current state.

Agents get the usual tools (`read_file`, `write_file`, `edit_file`, `revert_file`,
`list_dir`, `grep`, `run_tests`, `submit`, and on Live Main `checkpoint`). Tests run as a
per-workspace uid inside a shared workcell, and the workcell never issues syscalls
against its own FUSE mounts (see `containers/workcell/README.md` for the FUSE hazards this
avoids).

## Repository layout

| Path | What |
|---|---|
| `containers/workcell/` | Go: `livefs` FUSE union filesystem, workcell/integrator HTTP API, local git server; Dockerfile |
| `packages/protocol` | shared types (coordinator API, workcell API, notices, events) |
| `packages/sigdiff` | entity-level TS change classifier (none / additive / body / signature) |
| `packages/core` | the coordinator (promotion rule, read-set index, queue, fan-out) over a SQL interface; HTTP router + clients |
| `packages/agent` | agent session, Live Main + PR-flow + push-to-branch strategies, Claude Haiku tool loop, scripted agent |
| `packages/swarm` | scheduler (dependencies, change-order release), runner, metrics + scoreboard |
| `packages/planner` | load-bearing code detection and contract tagging |
| `apps/edge` | Cloudflare Worker + Durable Objects (Coordinator, Workcell container, SwarmAgent, Run) |
| `apps/local` | the same system on one machine: Node hub + Docker workcells; the `livemain` bench CLI |
| `apps/web` | the web app (Vue 3, Pinia): repositories, code with live overlay notes, landings, dispatch, swarms, agents, keys |
| `packages/api` | API v1: repos, tasks, swarms, agents, landings, keys, live events (SSE); runtime-agnostic |
| `apps/dashboard` | benchmark dashboard: spreadsheet grid, main timeline, overlays, notices, scoreboard |
| `tools/synth-swarm` | synthetic coordinator stress test (10k scripted agents, no LLM) |
| `demo-repo/` | the benchmark codebase: a TypeScript spreadsheet formula engine, stubbed |
| `bench/` | task bank (~300 tasks), reference solutions, oracle test generator, results |
| `docs/` | workcell API contract, demo repo spec |

## Run it

Requirements: Node ≥ 20, pnpm 10, Docker (with FUSE, e.g. Docker Desktop), Go 1.26 only
for workcell unit tests. Wrangler needs Node ≥ 22.

```bash
pnpm setup                                                     # deps, sigdiff, dashboard, workcell image
pnpm livemain serve                                            # the web app + API v1 at http://localhost:8787
pnpm livemain compare --agents 8 --tasks 60                    # all three strategies, scripted agents
pnpm livemain run --strategy live-main --agents 8 --keep-serving   # dashboard at http://localhost:8787
ANTHROPIC_API_KEY=... pnpm livemain run --mode llm --agents 8  # real Claude Haiku 4.5 agents
pnpm synth --agents 10000 --duration 60 --think 5000           # synthetic coordinator scale test
pnpm test                                                      # unit + integration tests (TS)
pnpm test:e2e                                                  # TS against the real Docker stack (FUSE, git, vitest)
pnpm validate                                                  # task bank: 5-step validator
pnpm --filter @livemain/bench oracle:libreoffice               # cross-check the oracle in LibreOffice Calc
(cd containers/workcell && go test ./... && scripts/itest.sh)  # Go unit tests + Docker FUSE integration
```

`livemain serve` is the product on one machine: create or import a repository (or start from
the demo formula engine), add model keys (Anthropic, OpenAI, Gemini, OpenRouter or any
OpenAI-compatible endpoint; stored encrypted, write-only), dispatch swarms, and watch agents
land: the code view shows each agent's pending change in the margin beside the line it will
land on. Data lives in `.livemain/`. The same API (`/v1`, see `packages/api`) is what the
`lm` CLI and its MCP server use.

Scripted mode replays reference solutions through the exact same tools and protocol as
the LLM agents (with simulated model latency), so strategy comparisons are deterministic
and free. LLM mode runs Claude Haiku 4.5 workers.

### Cloudflare

Needs Workers Paid (Containers and Artifacts). The deployed Worker sits behind Cloudflare
Access and also verifies the Access token itself, so its API answers 503 until Access is set up.

```bash
pnpm --filter @livemain/web build
cd apps/edge
openssl rand -base64 32 | npx wrangler secret put LIVEMAIN_MASTER_KEY   # seals model keys at rest
npx wrangler deploy        # assets, the workcell image (built for linux/amd64, pushed), the Worker
```

Then protect it: Cloudflare dashboard → Workers & Pages → `live-main` → Settings → Domains &
Routes → workers.dev → enable **Cloudflare Access**, and add who may sign in (Zero Trust →
Access → Applications → the new application → policy, e.g. your email or GitHub). Copy the
application's **Audience (AUD) tag** and your team domain (`<team>.cloudflareaccess.com`):

```bash
npx wrangler deploy --var ACCESS_TEAM_DOMAIN:<team>.cloudflareaccess.com --var ACCESS_AUD:<aud>
```

(or put both in `wrangler.jsonc` `vars`). Sign in at `https://live-main.<subdomain>.workers.dev`,
add model keys under Settings → Model keys, and create repositories; they live in Artifacts
(namespace `live-main`).

`git` works against the same host: create a token under Settings → Git tokens, then
`git clone https://live-main.<subdomain>.workers.dev/git/<owner>/<repo>.git` (any username,
the token as the password). Add a second Access application for the path `/git` with a
**Bypass** policy, since git cannot sign in through Access; the Worker checks the token.
A push to main lands through Live Main (promotion rule, impact tests, notices to agents);
`git push -o change-order` lands it as a change order. Locally, the same gateway is at
`http://localhost:8787/git/<owner>/<repo>.git`.

### The `lm` CLI and Claude Code

```bash
pnpm --filter @livemain/cli build && npm install -g ./apps/cli
lm auth login --host https://live-main.<subdomain>.workers.dev   # approve the code in the browser
claude mcp add livemain -- lm mcp                                 # Live Main tools in Claude Code
```

`lm` covers repos, tasks, swarms, landings, agents and approvals (`lm help`). `lm mcp` gives
Claude Code operator tools (dispatch, swarm status, approvals) and agent tools: dispatch with
the worker `claude-code` and each Claude Code session or subagent claims a task with
`claim_task` and works it in a Live Main overlay (notices, impact tests and approvals included).
On Cloudflare, add the path `cli` to the Access Bypass application (as for `git`).

The benchmark runner is on the same Worker: `POST /api/runs`
`{"strategy":"live-main","agents":32,"workcells":8,"tasks":120}` (its `--mode llm` reads the
`ANTHROPIC_API_KEY` secret), with the dashboard at `/dashboard/`. `wrangler.local.jsonc` runs
it with the workcell image's git server standing in for Artifacts (`GIT_REMOTE_BASE`);
`wrangler.coordinator-only.jsonc` runs just the Durable Objects (no containers) for synthetic
scale tests (`POST /api/synth-runs`, then `pnpm synth --url https://<worker>/runs/<id>`).

To run the product API and web app on the Worker locally (Durable Objects under `wrangler dev`,
workcells and git server from the native Docker stack, so FUSE works on macOS):

```bash
pnpm livemain up --workcells 2                       # git server, integrator, 2 workcells
pnpm --filter @livemain/web build && pnpm --filter @livemain/edge assets
echo "LIVEMAIN_MASTER_KEY=$(openssl rand -base64 32)" >> apps/edge/.dev.vars
cd apps/edge && npx wrangler dev -c wrangler.dev.jsonc --port 8788
```

To host the repositories in Cloudflare Artifacts instead of the local git server (Workers Paid
and `npx wrangler login` first; Artifacts has no local simulator, so this uses the real service):

```bash
cd apps/edge && npx wrangler dev -c wrangler.dev-artifacts.jsonc --port 8788 --persist-to .wrangler/state-artifacts
```

Note: `wrangler dev` builds `linux/amd64` containers. On Apple Silicon they run under
emulation, where FUSE is unreliable; use the native Docker stack (`pnpm livemain`) for local
benchmarks.

## Baselines

All three strategies use the same tasks, scheduler, agent loop, prompts and test runner.
Only version control differs:

- **pr-flow**: a branch per agent; merging requires the branch to be up to date with main
  and the tests to pass on the rebased branch (GitHub "require branches to be up to date").
- **push-to-branch**: Cursor-style; everyone pushes to one branch, a rejected push pulls
  with rebase, the agent resolves conflicts and pushes again, no re-test required.
- **live-main**: this project.

## Status and limits

See `PLAN.md` for the plan and its phase gates, and the per-component READMEs for
measured overheads and known limitations.
