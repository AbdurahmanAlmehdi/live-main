# Live Main for developers: product plan

Positioning: Live Main replaces GitHub for an age where AI agents build and maintain most
software. Agents are first-class actors with their own identities and provenance; hosted
repositories and git through Live Main are the primary path, and GitHub connect is a
migration bridge. Follow-ups: `docs/cloudflare-port.md`, `docs/accounts-plan.md`.

Goal: turn the working prototype (benchmark runs on a local Docker stack or `wrangler dev`)
into something a developer uses on their own code, three ways:

1. **`lm`**, a CLI in the spirit of `gh`, with `lm mcp` exposing the same operations to Claude
   Code and other MCP clients;
2. **the web app** (working name livemain.ly), where a team creates or connects a repo, adds
   its own model keys and dispatches agents;
3. **external agents** (Claude Code, Codex CLI, Cursor, …) joining a swarm as workers.

Decisions taken: Anthropic, OpenAI, Gemini and any OpenAI-compatible endpoint (incl.
OpenRouter) at launch, plus external coding agents; hosted repos and GitHub-connected repos
are equally first-class; the CLI (with MCP mode) is built first; the web app is designed
from HTML mockups (brief: `docs/design-brief.md`).

## 1. What changes, in one table

| Today | Product |
|---|---|
| a *run* = a benchmark (task bank, scheduler, scoreboard) | a *repository* with a live main that lives forever; *swarms* are batches of tasks dispatched onto it |
| one Coordinator DO per run | one Coordinator DO per repository (per live branch); runs become swarms inside it |
| tasks come from `bench/tasks.json` | tasks come from people (web, CLI, MCP), issues, or a planner that splits a goal |
| Claude Haiku tool loop only | `ModelProvider` adapters: Anthropic, OpenAI, Gemini, OpenAI-compatible; external agents over MCP |
| Anthropic key in a Worker secret | each account brings its own keys, encrypted, used only inside the Agent DO |
| no users, debug routes | accounts, orgs, roles, tokens, audit log, quotas |
| dashboard = live run view | the web app: repo, code, overlays, swarms, landings, settings |
| repo in Artifacts or the local git server | hosted (Artifacts) **or** GitHub-connected (GitHub App), same coordinator either way |

The core (livefs overlays, read sets, checkpoints, sigdiff classes, promotion rule, impact
tests, change orders, integrator) does not change. Everything below wraps it.

## 2. Domain model (the words humans and the API use)

| Term | Meaning | Today's name |
|---|---|---|
| Repository | code + its live main; hosted or connected to GitHub | run repo |
| Main | the shared live line; every landing is a git commit on it | main |
| Task | one unit of work with a goal and acceptance tests (optional) | task |
| Swarm | a batch of tasks dispatched together with a model mix and a budget | run |
| Agent | one worker on one task: our loop on a provider/model, or an external agent | agent / SwarmAgentDO |
| Overlay | the agent's private layer over main (files written, files read) | overlay |
| Checkpoint | the overlay's view advancing to the latest main | checkpoint |
| Notice | "main moved under you": interrupt / review / ignore, with diff | notice |
| Landing | an overlay promoted into main (a commit) | promotion / landing |
| Change order | a contract change that jumps the queue and interrupts readers | change order |
| Guard | a breakage stopped before landing (impact tests) | impact-failed |

The web app may pick friendlier labels (the design brief asks for that), but the API and CLI
keep these.

## 3. Architecture

```
 lm (CLI) ─┐                       ┌─ Repo Coordinator DO (one per repo/branch; today's Coordinator)
 lm mcp ───┼─► Worker: API v1 ─────┼─ Swarm DO (today's RunDO: scheduler, budget, CI)
 web app ──┘   auth, tokens,       ├─ Agent DO (provider loop; holds the decrypted key in memory only)
 MCP (HTTP)    rate limits         ├─ Account DO (keys vault, quotas, usage)
               SSE/WebSocket ──────┤
                                   ├─ Workcell containers (FUSE overlays, tests) — per org, never shared
 GitHub App ◄── webhooks/sync ─────┴─ Artifacts (repo storage; the GitHub mirror for connected repos)
```

### 3.1 API v1 (one surface for CLI, MCP and web)

REST + JSON on the Worker, token-scoped, versioned under `/v1`. Events over SSE (CLI) and
WebSocket (web, hibernation as today).

- `auth`: device flow for the CLI (`/v1/auth/device`), session cookies for web, personal
  access tokens with scopes (`repo:read`, `repo:write`, `swarm:dispatch`, `keys:write`).
- `repos`: create (empty or template), import (git URL), connect (GitHub App installation),
  list, view, delete; `git` endpoint for clone/fetch (hosted repos).
- `repos/:r/main`: head, log (landings), show (landing detail: diff, classes, impact tests,
  auto-merged paths), tree/blob at a version.
- `repos/:r/tasks`: create, list, view, cancel; `repos/:r/change-orders`: create.
- `repos/:r/swarms`: dispatch (tasks + model mix + budget + concurrency), view, pause,
  resume, stop; `swarms/:s/events` stream.
- `repos/:r/agents`: list, view (transcript, tool calls, usage, cost), stop, retry.
- `repos/:r/overlays`: list, view (writes, read set, pin, notices), diff vs main.
- `repos/:r/workspaces`: open / tools / checkpoint / submit / close (the external-agent
  protocol, §3.5).
- `keys`: set / list (masked) / delete / test, per provider, per account or org.
- `usage`: tokens and cost per swarm, agent and provider; container minutes.

Today's coordinator routes (`/api/register`, `/api/promote`, …) stay internal (DO-to-DO and
workcell-to-coordinator) and are not exposed.

### 3.2 Model providers

`packages/agent/src/llm-agent.ts` is Anthropic-specific today. Split it:

- `ModelProvider` interface: `complete({system, messages, tools, maxTokens, cache}) →
  {content blocks, toolCalls, usage, stopReason}` in one normalized shape; retries and
  rate-limit backoff inside the adapter.
- Adapters: `anthropic` (prompt caching as today), `openai` (Responses API with function
  tools), `gemini`, `openai-compatible` (base URL + key; covers OpenRouter, vLLM, Ollama,
  LiteLLM). Each adapter owns tool-schema translation and its own cache hints.
- The tool loop (`runLlmAgent`) becomes provider-agnostic: same tools, same session, same
  resumable-slice behavior on DO alarms.
- Model catalog per provider fetched at key-test time (no hard-coded model ids in the UI);
  per-model pricing table for cost estimates, overridable.
- Per-swarm model mix: e.g. contracts and change orders on a stronger model, leaves on a
  fast one (today's `--co-model` generalised to rules by task kind/label).
- A conformance suite: every adapter runs the mocked tool-loop test and one recorded live
  smoke test per provider.

### 3.3 Keys and money

- Keys are encrypted with an org data key (envelope encryption; KEK in a Worker secret),
  stored in the Account DO, decrypted only inside the Agent DO for the duration of a slice,
  never sent to containers, logs, events or the browser (write-only after save).
- Budgets on every swarm: max agents, max tokens, max cost, max wall time; hard stop when
  hit; the dispatch screen shows an estimate before launch.
- Platform cost (containers, DOs, Artifacts) is ours: free tier with container-minute quota,
  then paid plans. Model cost is the user's (BYO key). OpenRouter keys let one key cover many
  models.

### 3.4 Repositories: hosted and GitHub-connected

- **Hosted**: an Artifacts repo per repository (today's path). `git clone
  https://livemain.ly/<org>/<repo>.git` with token auth; push to `main` from humans goes
  through the coordinator as a landing (same promotion rule, so human pushes also get read-set
  notices and impact tests).
- **GitHub-connected** (GitHub App with contents, pull requests, checks, webhooks):
  - Artifacts holds a mirror that is the working copy for overlays and the integrator.
  - Landing modes, chosen per repo: (a) *direct*: each landing is pushed to the GitHub branch
    (fast-forward; requires the App to bypass branch protection or a dedicated branch);
    (b) *batched PR* (default): landings accumulate on `livemain/main`, and Live Main keeps one
    PR open to the protected branch, updated continuously, with a check run summarising
    landings and guards; humans merge it.
  - Human pushes on GitHub arrive by webhook and are recorded as external landings
    (`recordExternalLanding`, today's baseline path), so agents get notices for them.
  - Conflicts between a human GitHub push and in-flight overlays resolve exactly like agent
    landings: checkpoints merge, notices fire.
- One coordinator per *live branch*; most repos have one (main). Feature branches can be
  opened as additional live lines later.

### 3.5 External agents (Claude Code, Codex, Cursor, …)

The FUSE read set is the core advantage; external agents run on the user's machine where we
have no FUSE. Two modes, in order:

1. **Remote workspace over MCP (primary).** `lm mcp` (or the hosted MCP endpoint) exposes
   `workspace_open(task)`, `read_file`, `write_file`, `edit_file`, `list_dir`, `grep`,
   `run_tests`, `checkpoint`, `submit`, `notices`. The files live in a workcell overlay; the
   agent edits through tools, so the read set and staleness detection are exact. Claude Code
   then works on Live Main the same way our own agents do. Tests run in the workcell.
2. **Local checkout (secondary).** `lm workspace attach <task>` materialises the overlay into
   a local directory and syncs writes back on `lm checkpoint` / `lm submit`; the read set is
   approximated (files opened via the agent's file tools when its harness reports them,
   otherwise the import closure of written files). Weaker staleness detection, clearly
   labelled in the UI ("approximate read set").

Either way an external agent is an agent in the swarm: it appears in lists, gets notices, its
landings go through the same promotion rule.

### 3.6 Tenancy and safety

- Workcells per org (never shared across orgs); per-workspace uid isolation stays.
- Container egress: package registries allowed, everything else off by default (repo setting).
- Repo code runs in tests: treat as untrusted; no secrets in container env; model keys never
  reach containers.
- Audit log for key changes, dispatches, landings, settings.
- Quotas and rate limits per token and org; abuse limits on free tier.

## 4. `lm`: the CLI

TypeScript, reusing `@livemain/protocol` types; published to npm (`npx @livemain/cli`) and as
single-file binaries. Same command shape as `gh`; every command has `--json` and `--repo`.

```
lm auth login | status | logout | token
lm repo create <name> [--template] | import <git-url> | connect <owner/repo> | list | view | clone | delete
lm keys set <provider> | list | test <provider> | rm <provider>
lm task create "<goal>" [--tests path] [--label] | list | view <id> | cancel <id>
lm swarm dispatch [--tasks file|ids] [--model rule]... [--agents N] [--budget $] [--watch]
lm swarm list | view <id> | watch <id> | pause | resume | stop
lm agent list [--swarm] | view <id> | logs <id> [-f] | stop <id> | retry <id>
lm overlay list | view <agent> | diff <agent>
lm main log | show <version> | status
lm notices [--agent] [-f]
lm change-order create "<contract change>"
lm workspace attach <task> | checkpoint | submit | close        # external agents, local mode
lm mcp [--repo]                                                  # stdio MCP server
lm local up | down | run ...                                     # today's Docker stack (self-host/dev)
```

`lm mcp` exposes two tool groups: *control* (dispatch, list swarms/agents/overlays, read
notices, view landings) for a developer driving Live Main from Claude Code, and *workspace*
(§3.5) for Claude Code acting as a worker.

## 5. Web app

Information architecture (the design brief turns this into screens):

- **Org home**: repos, active swarms, spend this month.
- **Repository**: Code (tree + file view, with live overlay markers: "3 agents are changing
  this file"), Main (landings timeline), Swarms, Agents, Overlays, Tasks, Settings (source,
  GitHub landing mode, keys, budgets, CI).
- **Dispatch**: write or pick tasks, choose the model mix, budget, concurrency, preview cost,
  launch.
- **Swarm live view**: today's dashboard, consolidated (grid, timeline, agents, notices,
  scoreboard).
- **Agent / overlay page** (the PR-page equivalent): diff vs main, read set, notices received,
  checkpoints, test runs, transcript, cost; actions: stop, retry, land now (if eligible).
- **Landing page** (the commit-page equivalent): diff, change classes, auto-merged files,
  impact tests run, guards it passed.
- **Settings**: account, org members, keys, tokens, billing, CLI/MCP setup.

The current dashboard (`apps/dashboard`, vanilla TS) becomes the swarm live view inside the new
app; the app shell itself moves to a component framework served by the same Worker (proposal:
Vue 3 with the Composition API and Pinia; see open decisions).

## 6. Phases and gates

| Phase | Scope | Gate |
|---|---|---|
| P0 Repo-centric core | Coordinator per repo; swarms inside it; tasks from API; RunDO → SwarmDO; API v1 skeleton; PATs | create a repo, dispatch 2 tasks over the API, both land; a second swarm on the same repo sees the first's landings |
| P1 CLI + MCP | `lm` (auth, repo, task, swarm, agent, overlay, main, notices) against hosted and `lm local`; `lm mcp` control tools | Claude Code, given only `lm mcp`, dispatches a swarm and reports its landings |
| P2 Providers + keys | `ModelProvider` + 4 adapters; key vault; budgets; cost tracking | the same 20-task swarm lands on each provider; budget stop works; keys never appear in logs/events (test) |
| P3 GitHub | GitHub App; import/connect; batched-PR and direct modes; webhook → external landing | human pushes on GitHub produce notices to agents; landings appear as one updating PR with a check run |
| P4 Web app | design directions → chosen system → screens (brief) → build | a new user signs up, connects GitHub, adds a key, dispatches, watches, merges the PR, without the CLI |
| P5 External agents | workspace MCP tools; `lm workspace attach` local mode | Claude Code as a worker lands a task with an exact read set; a stale read produces an interrupt it acts on |
| P6 Hardening | per-org workcells, egress policy, quotas, audit log, billing, observability | load test at 10 concurrent orgs; isolation tests; cost per landing measured |

P1 and P2 can run in parallel after P0. The design work (P4 directions) can start now.

## 7. Open decisions

1. GitHub landing default: batched PR (safe, slower) vs direct push to a branch (fast, needs
   bypass). Plan assumes batched PR.
2. Planner from a goal ("add XLOOKUP support") to tasks: in scope for P1 (as `lm task plan`) or
   later?
3. Self-hosting: `lm local` stays a dev/self-host path; is a supported self-hosted edition a
   goal?
4. Pricing: container-minute quotas per plan; free-tier limits.
5. Web app framework: Vue 3 (Composition API, Pinia) is the proposal; the existing dashboard
   is framework-free and would be embedded as the swarm live view.
6. Name and domain: "livemain.ly" is a working name; check availability and trademark before
   committing to it.
