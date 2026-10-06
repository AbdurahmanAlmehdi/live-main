# Cloudflare challenge submission: draft answers

Copy into the form at submission time; edit freely. Due October 14, 11:59 PM PDT.

## Project name

Live Main

## Project vision: what did you rethink, and why does it matter?

Git and pull requests assume people who take turns: branch, wait for review, rebase, merge.
Agents don't take turns. Put a swarm on one repository and most of their time goes to
rebasing and redoing work. In our benchmark, 16 agents with a pull-request flow wasted 93% of
their agent-minutes, and the riskiest conflict, an agent relying on code that another agent
changed, merges cleanly and goes unnoticed, because git never records what an agent read.

Live Main replaces branches with one live main. Each agent works in a thin overlay on it (a
FUSE filesystem), and every file it opens is recorded, so the system knows each agent's read
set, not just its diff. Submitting promotes the overlay: if something the agent read has
changed, it gets a notice with the diff and adapts in place; edits that only add to the same
file merge automatically; and the tests whose read sets touch the change run before it lands.
Main stays green. People use the same rules through plain `git push`, and protected paths wait
for a person's approval, with provenance (which agent, for whom, approved by whom) on every
version. On the full 336-task benchmark, Live Main finished in 26 minutes with zero rebases
and one regression; the pull-request flow took 79 minutes, made 2,215 rebases and let 28
regressions land.

## How you used Cloudflare

- **Workers**: the web app, the `/v1` API, the device-login and CLI endpoints, and a smart-HTTP
  git gateway (`git clone` / `git push`), behind Cloudflare Access; the Worker also verifies
  the Access JWT itself.
- **Durable Objects**: an OrgDO (people, git tokens, sealed model keys), one RepoDO per
  repository (the coordinator: promotion, approvals, events over hibernating WebSockets, and a
  durable swarm scheduler driven by alarms), and one RepoAgentDO per agent, which runs the
  agent's session in alarm slices or serves an external Claude Code agent's tool calls.
- **Containers**: workcells that mount the FUSE overlays and run the tests, and the
  integrator that merges and commits, scheduled next to their Durable Objects.
- **Artifacts**: every repository's main is an Artifacts git repo. Live Main creates, imports
  and forks repos, reads trees, blobs and history through the binding, mints scoped tokens,
  and serves clones and pushes through it.
- **Access**: sign-in for people; per-person git tokens and a device flow for the `lm` CLI
  and its MCP server, so Claude Code sessions can run swarms and work as agents.

## Instructions to run

Prerequisites: Node 20+ and pnpm 10, Docker with FUSE (Docker Desktop works); Wrangler needs
Node 22+ for the Cloudflare deploy.

```
pnpm setup              # dependencies, workcell image
pnpm livemain serve     # web app + API at http://localhost:8787 (demo repo included)
pnpm livemain compare --agents 8 --tasks 60   # Live Main vs two baselines, scripted agents
pnpm test               # tests
```

Cloudflare deploy and the `lm` CLI / Claude Code setup: see README → "Cloudflare" and
"The `lm` CLI and Claude Code".
