# `lm`: the CLI and the MCP server for Claude Code

Decisions (Oct 3, 2026): `lm mcp` serves both roles. A Claude Code session can be the
**operator** (create tasks, dispatch, watch, approve) that hands tasks to its own subagents, and
any session can be an **agent** that claims a task and works it. Agents work in a server-side
overlay through Live Main's tools, so they get notices, impact tests and approvals like built-in
agents. Login is a device flow. The target is the deployed Worker.

## External agents ("seats")

- Dispatch with the worker `{ kind: 'external', name: 'Claude Code' }`. The swarm schedules
  those tasks as usual; each started agent opens a **seat**: its session starts (overlay, pin)
  and it waits, `queued`, for a client to claim it.
- `claim` gives the caller the oldest open seat (optionally in one swarm): the agent id, the
  task (prompt, tests), and the Live Main working rules. Only the claimer may drive the agent.
- Tool calls (`read_file`, `write_file`, `edit_file`, `delete_file`, `replace_in_files`,
  `revert_file`, `list_dir`, `grep`, `run_tests`, `submit`) run `AgentSession.call` on the
  server; `give_up` ends the agent. Landing or giving up finishes the seat; 30 minutes without a
  call releases it (stopped).
- Locally the seat lives in the in-process `SwarmRun`; on Cloudflare in the agent's
  `RepoAgentDO`, which restores the session from storage for each call and saves it after.
- Tool definitions move to `packages/agent/src/tools.ts` and are shared by the LLM loop and MCP.

## Auth for the CLI

- Device flow: `POST /cli/device/code` → `{ deviceCode, userCode, verificationUrl }`; the person
  opens `/device?code=…` (signed in), approves; `POST /cli/device/token` returns a git token
  created for them ("lm on <host>"). Codes expire in 10 minutes.
- The CLI calls `/cli/v1/*` with `Authorization: Bearer lm_…`; the runtime verifies the token,
  sets the actor and serves the same `/v1` routes. On Cloudflare `/cli` is added to the Access
  Bypass application (like `/git`); `/v1` stays behind Access for the browser.
- `lm auth setup-git` makes git use the same token (credential helper `lm auth git-credential`).

## Commands

`lm auth login|status|logout|setup-git`, `lm repo list`, `lm clone <owner/repo>`,
`lm task list|create`, `lm swarm dispatch|list|watch|stop`, `lm main log|show`,
`lm agent list|view`, `lm approvals`, `lm approve|reject <id>`, `lm mcp`.

## MCP tools (`lm mcp`, stdio)

Operator: `repos`, `tasks`, `create_task`, `dispatch` (built-in models or Claude Code seats; its
result includes a ready prompt for subagents), `swarm`, `stop_swarm`, `approvals`, `decide`,
`landings`. Agent: `claim_task`, the work tools above (each takes the claimed `agent` id), and
`give_up`.

## Order

1. Shared tool definitions; seats in `SwarmRun` and `RepoService` (claim, call, release); tests.
2. Device flow, bearer tokens and `/cli/v1` in both runtimes.
3. Edge: `RepoAgentDO` seats, runner and Worker routing.
4. `apps/cli` (`lm`, bundled with esbuild) and `lm mcp`.
5. Web: device approval page; "Claude Code" as a worker on the Dispatch page.
6. Deploy; Access bypass for `/cli`; a swarm test with Claude Code as operator and subagents.

## Status (Oct 3, 2026)

Built and verified locally; deployed (the deployed `/cli` needs the Access bypass below).

- `apps/cli` builds `dist/lm.mjs` (one file, esbuild). Install: `pnpm --filter @livemain/cli build
  && npm install -g ./apps/cli`.
- Device login verified (code, approve, token stored at `~/.config/livemain/config.json`, mode 600).
- `lm mcp` verified with an MCP client standing in for Claude Code: an operator dispatched three
  tasks to Claude Code seats; two "subagents" claimed seats in parallel, edited through the agent
  tools, ran tests and submitted; both landed (a concurrent `registry.ts` edit auto-merged; one
  received a "main moved under you" notice), one claimed the third task, and both stopped on
  "nothing left". With a protected path, `submit` answered "not landed yet" within 20 s,
  `lm approve` approved it, and the next `submit` landed with the approval recorded.
- Found while testing: a submit that waits for an approval must return before MCP clients time
  out (external agents wait 20 s, then are told to submit again); pending approvals of an agent
  that ends are now withdrawn; `claim_task` answers "no task is free right now" (not an error)
  when other agents hold the remaining tasks.

Deployed setup: add the path `cli` to the Access Bypass application that already covers `git`.
