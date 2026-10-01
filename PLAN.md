# Live Main: Build Plan

Companion to the brainstorm notes. Decisions locked so far:
- Build it right; scope is not cut to fit the Oct 14 deadline.
- Real FUSE overlay (not a userspace file API).
- Worker agents run on Claude Haiku 4.5 (`claude-haiku-4-5`).
- Artifacts and Containers access not yet confirmed (Phase 0 gate).

---

## 0. Platform facts checked (Oct 1, 2026) and what they change

| Fact (Cloudflare docs) | Implication for the design |
|---|---|
| Containers support FUSE in production, and Miniflare grants FUSE in local dev (Aug 2026) | Real FUSE overlay is feasible, locally and deployed. Kernel OverlayFS (needs `CAP_SYS_ADMIN`) is not assumed. |
| **ArtifactFS** exists: a FUSE mount of an Artifacts repo built on a blobless clone with lazy blob hydration. It is **read-focused** and has no documented refresh or write path | Don't stack on it. Build our own FUSE daemon that reads straight from a local git object store and can swap its root commit. Check whether ArtifactFS is open source, since its hydration code is worth borrowing. |
| The Artifacts binding offers `create / get / fork / import / delete`, tokens, and `log / readCommit / readTree / readBlob / readFile`. **No commit-write or diff API** | The coordinator can *read* main from a Worker, but writes must go through `git push` (from a container, or isomorphic-git in a Worker). |
| Git protocol: push is v1 only. Some v1 capabilities (`filter`) are unsupported | Partial clones may not work. Not a problem for a small demo repo: each workcell keeps one full local mirror. |
| Event subscriptions: `pushed` events arrive via Queues | Good for the dashboard and audit. **Not** on the critical path, because latency isn't documented. The coordinator DO is the source of truth for ordering. |
| Limits: 1 GB per repo, 32 MB per blob, 2,000 git req/10s per repo, unlimited repo count | One Artifacts fork per agent overlay is fine. 10k synthetic agents must not all hit git on `main`, so they read through the coordinator and workcell caches. |
| Containers: up to 1,500 vCPU / 6 TiB of concurrent instances, custom types up to 4 vCPU / 12 GiB / 20 GB disk | Pack several agent mounts per workcell container to share the object store and build cache. That sharing is the CitC point. |

---

## 1. Architecture

```
            ┌──────────────── Workers (API, dashboard, agent tools) ────────────────┐
            │                                                                       │
  Agent DO ×N  (Haiku loop, tools)        Coordinator DO (single writer of "main")  │
     │  tool calls                          • version clock  v1, v2, …              │
     ▼                                      • overlay registry (agent → pin, files)  │
  Workcell container ×M  ◄──── control ───► • read-set index  (path → agents)       │
   ├─ livefs daemon (Go, FUSE)              • promotion queue + change-order lane   │
   │   /mnt/agent-k = commit(pin) ∪ upper_k   • notifications (WebSocket, hibernation)│
   │   logs open/lookup → read set           └──────────────┬────────────────────────┘
   ├─ shared git mirror of main (fetch)                     │ push (fast-forward only)
   ├─ shared build/test cache                               ▼
   └─ mergiraf, TS signature differ              Artifacts: main repo + fork per agent
```

**Components**

1. **`livefs`** (Go, `hanwen/go-fuse`): one mount per agent.
   - Lower layer: a git tree at the pinned commit SHA, served from the workcell's shared object store (`git cat-file --batch`, or go-git reads with no checkout).
   - Upper layer: a per-agent dir with whiteouts for deletes and renames.
   - Read set: log `lookup`/`open` per *generation*. `readdir` goes in a separate set (it only matters for glob-style loaders).
   - **Generation swap:** `advance(newSha)` atomically switches the lower root. Open handles keep the old generation, so an in-flight test run stays pinned.
   - Ignore list: `node_modules/`, `.cache/`, and build output come from an image layer and are never logged.
   - Control socket: `pin`, `advance`, `readset`, `diff-overlay`, `inbox`.
   - "The filesystem tells you": a virtual read-only `/.livemain/inbox` file, plus notices injected into tool results.
2. **Coordinator DO** (TypeScript, SQLite storage): owns the version clock, the overlay registry, the read-set index, classification, the promotion queue, and the change-order lane. It is the only component allowed to advance `main`.
3. **Integrator** (one container, or a role inside a workcell): applies promotions with `git push` (fast-forward only, so push acts as compare-and-swap), runs mergiraf for write-write cases, and runs post-land CI on main.
4. **Agent DO** (Agents SDK): one per worker agent. Runs the Haiku tool loop and calls the workcell for file and test tools. Its state survives container restarts.
5. **Workcell container** (Sandbox SDK 1.0): hosts K agent mounts, the shared git mirror, the shared test cache, and per-agent process isolation (separate uid, cwd, and tmp; unit tests need no ports).
6. **Dashboard Worker**: live main timeline, overlays, a notification feed, the spreadsheet grid, and side-by-side strategy runs.

---

## 2. Core protocols (the parts to get exactly right)

**Versions.** `main` is a sequence of commits v1, v2, …. Each agent has `pin = vN`, and `Δ(vA→vB)` is the set of paths changed between them.

**Checkpoint triggers** (harness-driven, not left to the model):
- before every `run_tests`
- every K tool calls (default 8)
- before `promote`
- immediately on an *interrupt-severity* notice

**Checkpoint = advance + classify.** For each path `p` in `Δ(pin→head)`:

| `p` is in … | Action |
|---|---|
| overlay (write-write) | Run a 3-way entity merge (mergiraf) of base@pin, base@head, and overlay. On success, rewrite the upper file. On failure, notify with conflict hunks. |
| read set (read-write) | Severity from a TS signature differ (exported types/signatures): **interrupt**. Body-only change: **review**. Whitespace/format-only: **ignore**. |
| neither | Nothing to do. |

Then `pin ← head`, generation++, and the read set resets for the new generation. Paths read in the old generation and not changed carry forward.

**Promotion rule** (the throughput win):
- The agent calls `promote` after green tests at `pin`.
- The coordinator computes `Δ(pin→head)`.
  - If it intersects **readSet ∪ writeSet**, reject: checkpoint, re-run tests.
  - Otherwise, **promote without re-testing**. Since the compiler and test runner opened every transitive import through FUSE, an empty intersection means nothing the tests depended on has moved.
- Promotions are serialized in the coordinator. The integrator builds the commit as head + overlay files and pushes it fast-forward. `main` advances, and readers of the changed paths are notified.
- Optional speculative mode: test against the projected head (main + queued promotions), Zuul-style.
- A post-land CI run on main stays as a safety net that measures what slipped through.

**Change orders.** These are tasks tagged as contract changes (auto-tagged by the planner). They get priority in the promotion queue, and on landing every agent whose read set touches the changed paths receives an *interrupt*.

**Planner.**
- Load-bearing score = import fan-in × co-change frequency from git history.
- Contract tasks are scheduled first, then leaf tasks fan out.

**Generated files and lockfiles** are regenerated after merge, never text-merged.

---

## 3. Repo layout (monorepo, pnpm + Go)

```
live-main/
  apps/
    api/            Worker: public API, agent-tool endpoints, auth
    coordinator/    Durable Object: versions, read-set index, promotion queue
    agent/          Agents SDK DO: Haiku loop + tools + strategy interface
    dashboard/      Worker + static UI (WebSocket to coordinator)
  containers/
    workcell/       Dockerfile, livefs (Go), control server, mergiraf, test runner
    integrator/     push/merge/CI role (may fold into workcell)
  packages/
    protocol/       shared TS types: versions, notices, severity, events (.d.ts shipped)
    sigdiff/        TS exported-signature differ (TS compiler API)
    strategies/     live-main | pr-flow | push-to-branch (same harness, swapped VCS)
    bench/          task seeding, run orchestration, metrics, report
  demo-repo/        spreadsheet formula engine (seeded into Artifacts as main)
  tools/
    synth-swarm/    10k scripted agents (prerecorded diffs) for coordinator stress
  scripts/setup     one-command deploy (wrangler + container build + seed)
```

---

## 4. Phases and exit gates

Each phase ends with a gate that must pass before moving on.

### Phase 0: Access and de-risking spikes
- Request Artifacts beta access and confirm the Containers plan. **This is the long pole, so do it today.**
- **Spike A: FUSE in a deployed container.** A minimal go-fuse union mount (git tree + upper) with open-logging, running in a Sandbox SDK 1.0 container on Cloudflare (not only local).
  - Measure `vitest` run time on the mount vs. a plain checkout.
  - Gate: overhead < 30%.
- **Spike B: Artifacts round trip.** create, fork, push from the container, `readFile` from a Worker, fast-forward-reject behavior, and `pushed` event latency.
- **Spike C: read-set noise.** Run vitest on a 50-function prototype of the demo repo and count files opened per single-function test.
  - Gate: the read set is a small fraction of the repo. If `tsc`/vitest open everything, switch to per-file transforms and `isolatedModules`, and drop full-project typecheck from the agent loop.
- **Fallback decision:** without Artifacts, keep an identical interface backed by a git server in the integrator container. Swap in Artifacts when access lands.

### Phase 1: Demo codebase and task bank (can run alongside Phases 2–3)
- TypeScript formula engine core: `Value` union, coercion, ranges, `#ERR` types, the function registry, and the parser/evaluator.
- ~400 function stubs, each returning `#NAME?`.
- Oracle test generator: expected outputs from formula.js, with a LibreOffice headless cross-check on a sample. Each function gets its own test file.
- Task bank of ~300 tasks:
  - 70% leaf
  - 15% shared helpers
  - 10% change orders, with release times
  - 5% traps, each a hand-designed clean merge that silently breaks a dependent, with a hidden detector test
- Gate: the reference solution passes 100%, and the stubbed repo fails exactly as expected.

### Phase 2: `livefs` daemon
- Union view, whiteouts, rename/unlink/mkdir, generation swap, read-set logging, ignore list, control socket, and the inbox virtual file.
- Tests: POSIX behavior suite (pjdfstest subset), a concurrent-writer stress test, and swap-during-open-handle cases.
- Gate: the worked example (section 4 of the notes) runs as a scripted integration test at the FS level and yields the correct classifications.

### Phase 3: Coordinator, integrator, API
- Coordinator DO: SQLite schema (versions, overlays, read sets, queue, notices), classification, the promotion rule, change-order priority, and a WebSocket fan-out with hibernation.
- Integrator: apply overlay → mergiraf → regenerate generated files → push fast-forward → post-land CI.
- `sigdiff` package for severity.
- Gate: the worked example passes end to end with *scripted* agents and real Artifacts commits, and `main` matches the expected v4.

### Phase 4: Agent harness
- Agent DO with the Haiku tool loop:
  - Tools: `read_file`, `write_file`, `edit_file`, `list_dir`, `grep`, `run_tests`, `checkpoint`, `promote`, `read_inbox`. Every file tool goes through the FUSE mount.
  - The harness enforces checkpoint triggers and injects notices into tool results.
  - Budget caps per task (tokens, tool calls, wall time).
- Strategy interface: `live-main`, `pr-flow` (branch → rebase on conflict → merge queue), and `push-to-branch` (Cursor-style pull --rebase, agent resolves). The same tasks, model, and prompts run against all three.
- Gate: 20 real agents finish 50 tasks on each strategy without harness bugs.

### Phase 5: Planner, change-order lane, entity merge polish
- Fan-in × co-change scoring, contract-first scheduling, and the timing of change-order injection.
- Gate: a mid-run change order produces interrupts only for agents whose read sets touch it (verified against ground truth).

### Phase 6: Benchmark and dashboard
- Benchmark runner: 3 strategies × 300 tasks × 2–3 seeds. Metrics:
  - time to all-green
  - wasted agent-minutes and tokens
  - rebase/retry count
  - promotions without retest
  - traps caught before landing vs. after
  - false-interrupt rate
- Dashboard:
  - spreadsheet grid flipping `#NAME?` → value
  - live main timeline
  - per-agent overlay and read-set view
  - notification feed
  - side-by-side race and final scoreboard
- Gate: a full run is reproducible from one command, and the report is generated automatically.

### Phase 7: Scale evidence
- `synth-swarm`: 10k scripted agents replaying recorded diffs and read sets against the coordinator, with no LLM.
- Shard the read-set index across DOs by path prefix if a single DO saturates. The version clock stays single.
- Publish throughput and latency curves, clearly labeled synthetic.
- Optional: a real 1,000-agent run if budget allows.

### Phase 8: Ship
- One-command setup, README with the architecture and benchmark results, open-source license, and a 5–10 min demo video following the notes' arc.

---

## 5. Key risks

| Risk | Mitigation |
|---|---|
| Artifacts access delayed | Phase 0 fallback git server behind the same interface |
| Tooling opens the whole repo, so read sets are useless | Spike C, per-file transforms, ignore list; symbol-level classification as an upgrade |
| FUSE overhead slows tests | Kernel attr/entry caching with short TTL plus `FOPEN_KEEP_CACHE` within a generation; measured in Spike A |
| Promote-without-retest lets a break through (dynamic imports, runtime config reads) | Post-land CI measures it, and the "traps" metric reports it honestly |
| Baselines look strawmanned | Same harness, model, and prompts; baselines tuned in good faith (Cursor-style is the strong one) |
| Haiku struggles on contract changes | Planner-level model override for change-order tasks (decide after Phase 4 data) |
| Coordinator DO throughput at 10k | Batch read-set uploads per checkpoint; shard the index; measure in Phase 7 |

---

## 6. Open decisions (non-blocking)

- **Symbol-level read sets:** start file-level and upgrade by intersecting changed symbols with the agent's imports.
- **Agents per workcell (K):** pick after Spike A measurements.
- **Speculative promotion testing:** default off; enable if post-land CI shows real escapes.

---

## 7. Status (Oct 2, 2026)

Gate by gate. "Verified" means exercised by an automated test or a recorded run in this repo.

| Phase | Gate | Evidence | Status |
|---|---|---|---|
| 0 · Spike A | FUSE in a Cloudflare container, overhead < 30% | `containers/workcell` itest `fuse_overhead` (Docker): +2–20%; under `wrangler dev` the Workcell DO starts the container with FUSE privileges and live-main runs end to end (`cf-live-14`: 2 landings, registry auto-merged, CI green) | Verified locally; not yet on deployed Cloudflare (no account access in this session) |
| 0 · Spike B | Artifacts round trip | `POST /api/spikes/artifacts` (apps/edge/src/spike.ts): create → container push → readFile → fork → non-fast-forward rejection | Implemented; needs Artifacts beta access to run |
| 0 · Spike C | Read set is a small fraction of the repo | itest `READSET`: a single-function test reads **12 of 387** demo-repo files (lookups kept separate) | Verified |
| 0 · Fallback | Identical interface without Artifacts | `workcell serve-git` (local Artifacts stand-in) + `GIT_REMOTE_BASE` | Verified |
| 1 | Reference solution 100% green; stub fails as expected | `pnpm validate`: 5 steps, all checks pass (incl. "no change orders landed" world); LibreOffice cross-check 95.9% with every disagreement explained (`bench/oracle/LIBREOFFICE.md`) | Verified |
| 2 | Worked example at FS level; POSIX subset; concurrency; swap stress | itest `worked_example_C_A_B`; `TestFusePosixSubset`, `TestFuseConcurrentWriters`, `TestFuseReadersDuringSwaps` (60 consecutive passes) | Verified |
| 3 | Worked example end to end with scripted agents and real commits | `packages/core` + `packages/agent` worked-example tests; `apps/local` real-stack e2e (`pnpm test:e2e`) on real git + FUSE + vitest | Verified (local git server; Artifacts pending access) |
| 4 | 20 real agents × 50 tasks per strategy | Harness verified with scripted agents (16 agents × 336 tasks, all strategies) and a mocked-Claude loop test; LLM mode wired (`--mode llm`, Haiku 4.5, prompt caching, resumable on DOs) | **Needs `ANTHROPIC_API_KEY`** to run real Haiku agents |
| 5 | Change-order interrupts only to agents whose read sets touch it | `coordinator.test.ts` "change-order landing escalates read hits"; fan-out is read-set indexed; planner tests (append-only detection) | Verified |
| 6 | Reproducible full run from one command, report generated | `pnpm livemain compare …` writes `bench/runs/<run>/{events.jsonl,metrics.json,scoreboard.md}` + a compare scoreboard; dashboard renders live runs. Full bank, 16 agents: live-main 336/336 in 25.6 min (final CI 2086/0, 30 breakages caught, 0 rebases); pr-flow 252/336 in 79.4 min (1894 conflicted rebases, 28 landed breakages); push-to-branch 262/336 in 50.9 min (2836 conflicted rebases, 30 landed breakages). 60-task seeds 2 and 3: live-main 60/60 both, baselines 53 and 57 (README Results) | Verified |
| 7 | 10k synthetic agents, labeled synthetic | `pnpm synth --agents 10000`: coordinator p99 promote ≈ 40 ms in process; 2k agents sustain ~290 promotions/s; same code driven over HTTP against the Coordinator DO under Miniflare | Verified (in process + Miniflare); deployed-DO numbers pending |
| 8 | One-command setup, README, license, demo video | `pnpm setup`, README, LICENSE (MIT), `docs/demo-script.md` | Video not recorded |

### Deviations from the plan (and why)

- **Workcell = Container DO with its own HTTP API** instead of the Sandbox SDK: the workcell
  needs a custom FUSE daemon anyway; the direct Durable Object Container API (`durable_object`
  scheduling policy, root capabilities for FUSE) is the thinnest fit.
- **Read set = files opened**, lookups tracked separately: vite stats every lazy registry
  target; counting lookups would make every test read the whole repo.
- **Promotion rule refined with change classes** (sigdiff): Δ ∩ reads only blocks on body or
  signature changes, and Δ ∩ writes auto-merges when both sides are additive. Without this the
  registry hot spot makes every promotion stale.
- **Test-impact check at promotion**: landed tests whose recorded read sets touch a
  non-additive change run on the merged tree before pushing. This is what catches traps.
- **Traps run after their victims** (scheduler rule, same for every strategy): otherwise a
  naive trap lands into a repo with nothing to break yet, and the benchmark measures nothing.
- **Change-order lane serialized**: two concurrent contract changes kept invalidating each
  other.
- **Scripted-agent budget counts merge attempts** (25), not submits: in pr-flow, the submit that
  only finishes a conflicted rebase is not a merge attempt, so counting it halved the
  baseline's budget.
- **Scripted edits are atomic**: registry insertions are `edit_file` calls on the anchor line,
  never a read-then-`write_file`, which on Live Main could write a pre-checkpoint copy back and
  silently drop entries that landed in between (the same hazard an LLM agent has with
  `write_file`; Live Main's impact check caught it as a breakage).
- **Speculative promotion testing** stays off (open decision §6); post-land CI shows no escapes
  of landed-code breakages in the recorded runs.
- **Overlay persistence**: each agent's overlay is published as a fast-forward-only ref
  (`refs/heads/overlay/<agent>` locally, a per-agent Artifacts fork on Cloudflare).
- **wrangler dev on Apple Silicon** builds amd64 containers that run under emulation; FUSE there
  is unreliable inside go-fuse's own mount sequence. Local benchmarks use the native Docker
  stack (`apps/local`); the Cloudflare path was exercised under `wrangler dev` with the
  fixture repo.

### Known limitations

- In the wild, a trap can land *before* the code that depends on its old behavior exists; no
  landed test reads it yet, so it breaks that later work silently in every strategy. The
  benchmark scheduler therefore runs each trap after the in-scope tasks it would break, so
  every trap measures what it is meant to: catching a breakage of landed code. A "post-land
  attribution" step (blame the version that turned a reader's tests red) would cover the
  general case.
- Scripted agents cannot adapt to semantic changes they did not anticipate; LLM agents can.
