# Web app + API v1: implementation plan

Scope (decided): Vue 3 + Pinia + Vite web app; a real repo-centric API v1 behind it; all five
screens from `docs/design-brief.md` plus the component library from the design system
(direction C2 · Margin with Ledger header; tokens and reference markup in the two design-system
artifacts, see memory).

## Backend

1. **Protocol** (`packages/protocol/src/v1.ts`): resource types for repos, tasks, swarms,
   agents (with live state), overlays, landings, notices, keys, usage; request bodies; the
   `/v1` event envelope.
2. **Finer agent events** (`packages/agent`): `agent.state` (working, testing, checkpointing,
   interrupted, guarded, ready, …) and `agent.step` (tool, summary, ok) emitted by
   `AgentSession`, so the UI shows what each agent is doing; an abort signal so swarms can be
   stopped.
3. **Model providers** (`packages/agent/src/providers/`): `ModelProvider` interface; adapters
   `anthropic` (SDK, prompt caching) and `openai-compatible` (fetch, chat completions with
   tools) which covers OpenAI, OpenRouter, Gemini's OpenAI-compatible endpoint and custom base
   URLs. `runLlmAgent` becomes provider-agnostic. Pricing table for cost.
4. **Gitserver endpoints** (Go): `tree` (ls-tree at a ref), `log`, `diff` (commit vs parent,
   per-file patches) so the Code and landing views have data.
5. **`packages/api`**: runtime-agnostic service + `/v1` router over interfaces
   (`MetaStore`, `GitHost`, `CoordinatorHost`, `SwarmRunner`, `KeyVault`). One Coordinator
   per repo; swarms run inside it; one CI loop per repo.
6. **Local platform** (`apps/local`): SQLite meta store, gitserver-backed git host,
   Docker-stack swarm runner (scripted agents for the demo template, LLM agents with the
   user's keys), AES-GCM key vault with a local master key, single-user session.
   `pnpm livemain serve` runs API + web app. The Cloudflare port of the same service is a
   follow-up (the Worker/DO code paths exist for runs today).

## Frontend (`apps/web`)

- Vite + Vue 3 (Composition API, `<script setup lang="ts">`) + Pinia + vue-router + Tailwind
  with the design system's config; tokens as CSS custom properties; Atkinson Hyperlegible.
- Components (`src/components/lm/`): status chip, version pill, live-main indicator, file tree
  row with overlay markers, file view header, code view, diff (unified/split, word highlight,
  collapsed hunks), timeline row, notice card, agent row, swarm progress, budget meter, CLI
  snippet, key field, model-mix rule row, buttons, input, select, tabs, segmented control,
  table, command palette, toast, empty/loading/error.
- Screens: Get started; Repository (Code with margin notes, Main timeline, landing detail);
  Dispatch; Swarm live (+ 390 px view); Agent/overlay.
- Data: typed `/v1` client; Pinia stores; one event stream per repo (SSE) driving live state.

## Verification

Unit tests per package; API tests on in-memory fakes; an end-to-end run: create a repo from
the demo template over `/v1`, dispatch a scripted swarm, watch it land in the browser (light
and dark, 1440 and 390).

## Status (Oct 2, 2026)

Built and verified locally (`pnpm livemain serve`; two swarms of 10 and 40 tasks landed live in the browser,
light/dark at 1440 and the swarm view at 375):

- API v1 (`packages/api`): repos (template, empty, import by URL), code tree and files with
  margin notes from live overlays, landings with parsed diffs and change classes, tasks,
  swarms (dispatch, estimate, pause, resume, stop, budget and time caps), agents (state,
  steps, tests, guards, notices with what the agent did, overlay diff), keys (AES-GCM sealed,
  write-only, tested via the provider's model list), SSE events. Tests on an in-memory world.
- Providers: Anthropic (SDK, caching) and OpenAI-compatible (OpenAI, Gemini, OpenRouter,
  custom URL); the agent loop is provider-agnostic, reports state, steps, tests and cost.
- Gitserver: tree, log, diff, init, import endpoints (Go tests).
- Web app (`apps/web`): all five screens and the component library on the C2 design system.

Not done yet (honest gaps):

- Cloudflare: `/v1` runs on the local Node runtime only. The Worker/DO port needs a
  Platform on Durable Objects (one coordinator DO per repo, swarm runs as alarm-sliced DOs).
- GitHub connect (needs the GitHub App), external agents (needs `lm mcp`), the `lm` CLI.
  The UI says so where these appear.
- Direct `git push` to main bypasses the coordinator; changes reach main through agents.
- Auth: local single-user mode; hosted accounts, orgs and tokens are P6.
- Costs are tracked for Anthropic models; other providers report tokens (price unknown).
