# Live Main demo video: storyboard and voiceover script

Target: about 8 minutes at 1920×1080 and 30 fps. The motion graphics use the app's design
tokens: paper `#FBFAF7`, ink `#1F1D1A`, teal `#0C6A73`, and Atkinson Hyperlegible Next
and Mono.

## How it's built

| Piece | Tool | Source |
|---|---|---|
| Motion graphics, captions, final edit | Remotion (React) in `video/` | `video/src/` |
| Terminal scenes (Claude Code, `git push`, `lm`) | tmux driving a real shell, recorded with asciinema, rendered with agg | `video/rec/*.cast` → `video/public/rec/*.mp4` |
| App scenes | Playwright with Chrome on the deployed site, using a CDP screencast | `video/public/rec/*.mp4` |
| Voiceover | You, per scene, from the script below | `video/public/vo/<scene>.m4a` |

Each scene lasts as long as its voiceover file. Until a file exists, the scene uses the
planned length, so the cut works silently with captions.

## Scenes

| # | id | ~len | Picture | Voiceover |
|---|---|---|---|---|
| 1 | `cold-open` | 0:20 | Kinetic type: "GitHub was built for people taking turns." "Agents don't take turns." → Live Main wordmark | Git and GitHub were built for people who take turns: branch, open a pull request, wait for review, merge. Agents don't take turns. Put fifty of them on one repository and they spend most of their time fighting each other. |
| 2 | `problem` | 0:50 | Animated branches: agents branch from main, main moves, rebase loops, conflicts on `registry.ts`. Then the silent bug: A reads `coerce.ts`, B changes it, both merge cleanly, A is wrong. Counter: 93% of agent-minutes wasted (PR flow, 16 agents, 336 tasks). | In our benchmark, sixteen agents with a normal pull-request flow wasted 93 percent of their time rebasing and redoing work. Worse, git can't see the most dangerous conflict: agent A reads how a helper works, agent B changes it, both merge cleanly, and A's code is now wrong. Nothing in git records what an agent *read*. |
| 3 | `idea` | 1:00 | Motion: one live main; each agent is a thin overlay (FUSE upper dir over main at a pin). Every `open()` is logged into a read set. Promotion rule as three cards: stale read → notice the agent, additive edits → auto-merge, behavior changes → impact tests from recorded read sets. | Live Main replaces branches with one live main. Each agent works in a thin overlay on top of it, a FUSE filesystem, and every file it opens is recorded. So we know each agent's read set, not just its diff. When an agent submits, Live Main promotes its overlay: if something it read has changed, it gets a notice and adapts in place; if two agents both appended to the same file, the edits merge automatically; and the tests whose read sets touch the change run before it lands. Main stays green. |
| 4 | `tour` | 0:40 | Browser: home → `demo/formula-engine` code → Main timeline (versions, CI on every landing) → Tasks (336). | This is the deployed app. The repo is a spreadsheet formula engine with 336 tasks and their acceptance tests. Instead of commits and pull requests, main is a timeline of versions, and every version passed CI before it landed. |
| 5 | `claude-code` | 1:40 | Split: Claude Code terminal (real run, sped up) and the live swarm page. Claude Code dispatches 6 tasks with worker `claude-code`, spawns 4 subagents; they claim seats over `lm mcp`; landings tick in with the "auto-merged" badge on `registry.ts`; a "main moved under you" notice. | Agents here are Claude Code. I asked Claude Code to dispatch six tasks and run four subagents. Each subagent claims a seat over the Live Main MCP server and works in its own overlay on the server. Watch the right side: they all edit the same registry file, and none of them ever rebases. When main moves under one of them, it gets a notice telling it exactly what changed. |
| 6 | `approvals` | 0:40 | Browser: Settings → protected path `src/helpers/**`; the agent's submit waits; Approvals tab → Approve; the landing shows "approved by". | Some paths need a person. Shared helpers are protected here, so when a subagent changes one, its landing waits for approval. I approve it, and the version records who approved it and which agent wrote it, on whose behalf. |
| 7 | `git-push` | 1:00 | Terminal: `git clone` → implement a function → `git push` → `remote: landed as v… · impact tests 30/30`. Then a push that breaks a helper → rejected with the failing test. | People still use plain git. Clone, edit, push. The push goes through the same promotion as an agent: it lands as a new version after its impact tests pass. Push something that breaks another function's tests, and it's refused with the test that failed. No broken main, ever. |
| 8 | `scale` | 1:00 | Browser: a 16-agent swarm on 40 tasks filling the swarm page. Then motion scoreboard (bench, 16 agents, 336 tasks): 25.6 vs 79.4 min, 0 vs 2,215 rebases, 1 vs 28 regressions, 9% vs 93% wasted. Then 10,000 synthetic agents, p99 promote 13.7 ms. | At scale it isn't close. On the full 336-task bank with sixteen agents, Live Main finished in 26 minutes; the pull-request flow took 79 and still ended red. Zero rebases against more than two thousand. One regression against twenty-eight. And the coordinator handled ten thousand synthetic agents with a p99 promotion of fourteen milliseconds. |
| 9 | `cloudflare` | 0:45 | Motion architecture: Worker + Access → Durable Objects (Org, Repo, one per agent) → Containers (FUSE workcells, integrator) → Artifacts (git). | It's built entirely on Cloudflare. A Worker behind Access serves the app and the git gateway. Each repository and each agent is a Durable Object. Workcells are Containers running the FUSE overlays. And main itself is an Artifacts git repo you can clone. |
| 10 | `outro` | 0:20 | Wordmark, `npm i -g @livemain/cli`, `claude mcp add livemain -- lm mcp`, URL. | Live Main: version control for the era when AI writes the code. |

## Status

All footage is recorded on the deployed site (`public/rec/`):
- `swarm.mp4` + `claude.mp4`: the real Claude Code run (6 tasks, 4 subagents, v4–v9, with v7 approved).
- `push.mp4`: the clone, the stale push landing as v11, and the refused breaking push.
- `scale.mp4`: 40 tasks and 16 replay agents, from the Dispatch page.
- `tour.mp4`: the app tour.

The scene list, timings, callouts and captions live in `src/scenes.tsx`; the voiceover lines
are in `VOICEOVER.md`. Re-record a take with `tools/rec-*.mjs` (browser) or tmux + asciinema,
rendered by `tools/render-cast.sh` (terminal; `tools/scrub-cast.mjs` removes Claude Code's
promo, usage and tmux lines).

Render: `npm run render` (about 10 minutes; normalizes loudness). Preview and tweak:
`npm run studio`.
