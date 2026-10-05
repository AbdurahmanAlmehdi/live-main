I'm designing the web app for Live Main, a version-control platform for teams that run swarms of
AI coding agents on one codebase. First I need visual directions, then a design system, then
the screens that make or break the product. Please work in the steps below and stop where I ask
you to.

Research first (if you can)
If you can browse or have screenshots of real products, use them before proposing anything.

* Study patterns, not just products. Useful things to look at: a repository home page (file
  tree, README, latest commit), a pull request's "files changed" view, a commit page, a CI run
  page with live logs, a deployments list, a dense analytics dashboard with a left sidebar,
  keyboard-first issue lists, live activity streams, cost/usage pages, API-key settings.
* Study in depth: GitHub (repo home, PR, commit, Actions run), the Cloudflare dashboard
  (Workers overview, analytics, sidebar, how sparingly orange is used), Vercel (deployments,
  build logs), Linear (density, keyboard, command palette), Graphite (stacked PR review),
  GitButler (virtual branches: the closest existing idea to an overlay), Buildkite or
  Sentry (live streams that stay readable).
* In each step, cite the specific product and screen that informed a decision.
If you can't browse, say so in one line and work from your own knowledge of those products.

The product
Live Main replaces the branch → PR → merge loop for agent swarms. There is one shared, always
moving main. Each agent works in an overlay: a thin private layer of the files it has written,
on top of main. Live Main records every file an agent reads. When main moves under an agent,
the agent's view advances at its next checkpoint, and it gets a notice only if something it
wrote or read changed: an interrupt for a signature change, a review for a body change,
nothing for unrelated or purely additive changes. When an agent is done, its overlay is
promoted into main (a landing, which is a real git commit). Before landing, Live Main re-runs
the tests of code already on main that read what the agent changed. If they would break, the
landing is stopped (a guard) and the agent fixes it first. Contract changes (change orders)
jump the queue and interrupt every agent that read the contract.

Why people pick it: on a 336-task benchmark with 16 agents, Live Main landed 336/336 in 26
minutes with 0 rebases and 30 breakages stopped before landing; the GitHub-style PR flow landed
252 in 79 minutes with 1,894 conflicted rebases and 28 breakages that reached main.

* Platform: web app, desktop first (1440×900), must reflow to 1024 wide. A phone (390×844) is
  only for checking on a swarm: read-only status and stop/pause.
* Built with HTML/CSS and a component framework; designs must be buildable with standard web
  components (no canvas-only UI). Code views use a monospace face and familiar git diff
  conventions.
* Users: software engineers and tech leads. Comfortable with GitHub and the terminal,
  impatient with marketing UI. One human often watches 10 to 100 agents.
* Ways in: people create a repo here, import one by git URL, or connect a GitHub repo (then
  Live Main lands work back to GitHub as one continuously updated pull request). They add their
  own model keys (Anthropic, OpenAI, Google Gemini, OpenRouter or any OpenAI-compatible
  endpoint) and dispatch agents. External agents (Claude Code, Codex, Cursor) can also join a
  swarm as workers. Everything here also exists in a CLI (`lm`, like `gh`) and as MCP tools.
* Look and feel: familiar to a GitHub user (repo tabs, file tree, commits, diffs, statuses),
  with the calm density and restraint of the Cloudflare dashboard, and its own Live Main
  identity. Take cues, copy nothing: no logos, marks, illustrations or exact colours from
  GitHub or Cloudflare.
* Out of scope here: billing pages, org/member management, marketing site, docs.

Vocabulary
Use these terms in the UI unless you have a better plain-language label; if you rename one,
say what and why, and keep the term visible somewhere (people will see it in the CLI):
main, overlay, read set, checkpoint, notice (interrupt / review), landing, guard (a breakage
stopped before landing), change order, swarm, task, agent.

The screens
The content listed for each screen is a starting brief, not a spec. Use UX best practice and
your research to decide what belongs on each screen:

* add what's missing
* cut or move what doesn't earn its place
* merge or split screens where that helps the user
* tell me what you changed from this brief and why

Non-negotiables (keep these whatever else you change):

* Main is visibly live: wherever main appears, show its current version and what is moving
  toward it.
* Overlays show up where the code is: a file that agents are changing, or reading, says so in
  the file tree and the file view.
* Every agent and landing status is unmistakable: label plus icon, never colour alone. Agent
  states: queued, working, testing, checkpointing, interrupted (main changed something it
  read), guarded (a landing was stopped), ready to land, landed, gave up, stopped, error.
* Money is never a surprise: estimated and spent cost, and the budget, are visible when
  dispatching and while a swarm runs.
* Keys are write-only: after saving, a key is never shown again (masked, with a test button).
* Each primary action shows its CLI equivalent (copyable), e.g. `lm swarm dispatch …`.
* Scales from 1 agent to 100: lists group, filter and stay readable; live updates don't make
  the page jump.

1. Get started. A new user, from sign-up to a running swarm. A starting point:
   * create an empty repo, import by git URL, or connect a GitHub repo (and choose how work
     lands back: one updating pull request, or direct to a branch)
   * add a model key (provider, key, test it, pick the default model)
   * connect the CLI and MCP (`lm auth login`, `lm mcp` for Claude Code)
   * first dispatch
2. Repository. The page people open most; the GitHub repo page, made live. A starting point:
   * repo header: name, source (hosted / GitHub-connected), main's version, live activity
   * tabs: Code, Main (landings), Swarms, Agents, Tasks, Settings
   * Code: file tree and file view with overlay markers ("3 agents are changing this file,
     12 have read it")
   * Main: the landings timeline (commit list equivalent): who/what landed, files, change
     class, guards passed, human pushes from GitHub mixed in
   * a landing's detail page (commit page equivalent): diff, change class per file
     (additive / body / signature), files merged automatically, impact tests that ran
3. Dispatch. From "here is the work" to agents running. A starting point:
   * tasks: write them, paste a list, pick from Tasks, or import from issues
   * model mix: which provider and model does which kind of task (e.g. contract work and
     change orders on a stronger model, the rest on a fast one); external agents as workers
   * concurrency and budget (cost cap, time cap), with an estimate before launch
   * the CLI command for the same dispatch
4. Swarm live view. Mission control while a swarm runs. A starting point:
   * progress: landed / running / queued / guarded / gave up; time; cost against budget
   * main's timeline moving as landings happen
   * agents and what each is doing right now
   * notices stream (interrupts, reviews), change orders and who they interrupted
   * pause, resume, stop; jump to any agent
5. Agent and overlay. The pull-request page equivalent: one agent's work. A starting point:
   * task, model/provider (or external agent), status, cost, tool calls
   * overlay diff against current main (files written, with change class)
   * read set: files it read, which of them changed on main since its pin
   * notices it received and what it did about each
   * test runs, checkpoints, guards (what it would have broken and why)
   * transcript of the agent's steps, collapsed by default
   * actions: stop, retry, land now (when eligible); none of them buried, none of them
     dangerous by accident

Sample data (use it so the screens feel real and the numbers agree)

* Org: Acme. People: Lina Haddad (tech lead), Omar Saleh.
* Repo `acme/formula-engine`: a TypeScript spreadsheet formula engine, 387 files, connected to
  GitHub `acme/formula-engine`; lands back as one pull request, #482 "Live Main: 214
  landings". A second repo, `acme/billing-api`, is hosted on Live Main.
* Main is at v214. Today: 52 landings (41 from the swarm below, 11 earlier), 11 guards. Lina pushed "Fix rounding in ROUND" on GitHub,
  which arrived as v207 and sent review notices to the 2 agents that had read `round.ts`.
* Keys: Anthropic added (tested), OpenRouter added, OpenAI not added, Gemini not added.
* Swarm "Spreadsheet functions, batch 3": 60 tasks, 12 agents, budget $25, $7.40 spent,
  running 18 minutes. 41 landed, 12 running, 7 queued, 0 gave up, 0 rebases, 9 guards.
  Model mix: Anthropic · Claude Haiku 4.5 for function tasks (8 agents), Anthropic · Claude
  Sonnet 5.5 for contract work and change orders (2 agents), OpenRouter · an open-weights
  coding model (1 agent), External · Claude Code on Lina's laptop (1 agent).
* Change order "Function arity is a tuple" (changes the signature of `src/core/types.ts`),
  released at 40% progress (one of this swarm's tasks), interrupted the 9 running agents whose
  read sets included it; 2 of those turned out not to need any change.
* Agent a7, task "Implement DECIMAL", Claude Haiku 4.5, 46 tool calls, $0.21:
  * Overlay: `src/functions/math/DECIMAL.ts` (new, +34, additive),
    `src/core/registry.ts` (+1, additive), `src/helpers/radixParse.ts` (+6 −3, body).
  * Read set: 12 of 387 files, including `src/core/coerce.ts`, `src/core/errors.ts`,
    `src/helpers/radixParse.ts`, `tests/functions/DECIMAL.test.ts`.
  * Pinned at v209; main has moved to v214. Notices: v211 interrupt (`coerce.ts` signature,
    from the change order), v212 review (`errors.ts` body), v213 ignored (registry additive).
  * First landing attempt guarded: it would have broken BIN2DEC, HEX2DEC and OCT2DEC, whose
    tests are already on main and read `radixParse.ts`. It reworked the change; DECIMAL's
    7 tests pass; ready to land.
* Landing v214, "Implement TEXTJOIN" by agent a6: `TEXTJOIN.ts` (new) and one registry line,
  merged automatically with two concurrent landings; purely additive, so it landed without
  re-running tests.
* Agent ids, versions, hashes and paths are placeholders. Don't invent logos.

Step 1: visual directions (then STOP)
Propose 3 clearly different visual directions for this app. They should differ in structure
and personality, not just colour (for example: how much the live activity leads, how dense the
layout is, how the overlay concept is visualised). For each one:

* a name and a one-line idea
* palette (light and dark), typography (a UI sans paired with a monospace), shape language,
  density, and how motion is used for live updates
* the Repository screen (Code tab, with overlay markers) drawn in that direction, in dark and
  light, at 1440 wide
* the agent status set in that direction (all states, label plus icon)

Deliver each direction as one self-contained HTML file (Tailwind from a CDN is fine; inline SVG
icons; no external images or fonts other than Google Fonts), using the sample data.

Base each direction on patterns from real, well-regarded products (from your research, or
e.g. GitHub, the Cloudflare dashboard, Vercel, Linear, GitButler) and say which product
inspired what. Then stop and let me choose.

Constraints for every direction:

* Calm, precise, trustworthy: an engineering tool, not a toy, not a sci-fi control room.
* Live activity is legible at a glance and never makes the page jump; respect reduced motion.
* Status is the hero wherever an agent or landing appears. Each status has a label and an
  icon, not colour alone.
* Code and diffs are first-class: monospace, line numbers, standard +/− conventions, both
  unified and split diff.
* Light and dark mode, both designed (not inverted).
* Text contrast of at least 4.5:1; body text no smaller than 13 px; keyboard-first (command
  palette, shortcuts shown in tooltips), visible focus.
* No emoji, no gradient washes, no robot or brain illustrations, no "AI sparkle" icons, no
  stock imagery.

Be opinionated. Tell me which direction you would pick and why.

Later steps (don't start them until I've chosen):
Step 2: the design system for the chosen direction (tokens, type scale, components: status
chips, diff, file tree with overlay markers, timeline row, notice, budget meter, CLI snippet,
tables, empty/loading/error states).
Step 3: the five screens in that system, dark and light, plus the swarm view at 390 wide.
