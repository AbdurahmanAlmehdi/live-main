# @livemain/dashboard

The Live Main dashboard: a live, side-by-side race between the three merge strategies
(`live-main`, `pr-flow`, `push-to-branch`) on the same swarm and task bank. Vanilla TypeScript,
bundled with esbuild, no framework and no runtime dependencies beyond the workspace packages
`@livemain/protocol` (types) and `@livemain/swarm` (`computeMetrics`, `scoreboard`).

## Run it

```sh
pnpm --filter @livemain/dashboard build   # → apps/dashboard/dist (app.js, styles.css, index.html, bench/tasks.json)
pnpm --filter @livemain/dashboard dev     # watch + serve dist on http://localhost:5180/?mock=1
pnpm --filter @livemain/dashboard typecheck
```

`dev` accepts `--port N`. The build copies `bench/tasks.json` (only that file, never
`bench/solutions`) into `dist/bench/tasks.json`; if the bank has not been generated yet it warns
and live mode shows an empty grid.

With real data, the dashboard is served by whichever server owns the API:

- local: `apps/local` (the hub serves `apps/dashboard/dist` next to `/api/*` and the WebSockets)
- Cloudflare: `apps/edge` (`pnpm assets` copies `apps/dashboard/dist` into the Worker's assets)

Build the dashboard first, then start either server.

## URL parameters

| parameter | effect |
|---|---|
| `mock=1` | simulated three-strategy race, no backend needed |
| `speed=6` | mock only: simulated seconds per real second (default 6, a full race takes about 5 min) |
| `t=420` | mock only: start this many simulated seconds into the race (good for screenshots) |
| `runs=a,b,c` | runs to show side by side (up to 3); default is the latest run of each strategy |
| `focus=runId` | single-run focus view (named spreadsheet cells, agents table) |

Clicking a strategy name focuses that run; the run pickers in the top bar change the columns.
Both are reflected in the URL so a view can be bookmarked for the demo.

## What is on screen

- **Spreadsheet grid** (the hero). One cell per task, grouped by category. `#NAME?` until the task's
  test file passes in the latest CI run on main; `=FN()` (amber) when it landed and CI has not caught
  up; a value (green) when it passes; `#VALUE!` (orange) when it landed but its tests still fail;
  `#REF!` (striped pink) when it was green and went red again (a regression that landed). A corner
  triangle marks helpers, change orders and traps. Cells flash once when they change state.
- **Formula bar** per run: the latest landing, caught breakage or regression.
- **Agents behind head**: one bar per active agent, height = versions its pin is behind main; a pink
  cap marks a recent interrupt. The focus view shows the full table: pin, lag, read/write set sizes
  (from `/api/overlays`) and recent notices.
- **Main timeline**: versions as they land (agent, task, paths, auto-merge and change-order badges)
  with a landings-per-time sparkline and the last minute's rate.
- **Notices and rejections**: interrupts and reviews, stale promotions, breakages caught before
  landing (`impact-failed`), needs-rebase, push-rejected, rebases with conflict counts, change-order
  releases and CI regressions.
- **Scoreboard**: `computeMetrics` per displayed run, recomputed as events arrive, best value per row
  highlighted. "Copy as Markdown" uses `scoreboard()` from `@livemain/swarm`.

## Data flow

`GET /api/runs` lists runs (edge returns only `runId`; the strategy is then read from the id prefix
or the run's `run.started` event). Per run, `src/source.ts` opens `/runs/:id/ws?after=<seq>` and
folds `{ seq, event }` messages into a `RunModel` (`src/model.ts`); while the socket is down it polls
`/runs/:id/api/events?after=&limit=` every second and reconnects with backoff. Active overlays are
polled from `/runs/:id/api/overlays?status=active` every 2 s. The task bank comes from
`/bench/tasks.json`. Everything else (head, CI state, landings, notices, metrics) is derived from the
event stream, so a reconnect or a late join replays to the same picture.

## Mock mode

`src/mock.ts` builds a 286-task bank (242 real spreadsheet functions, helpers, change orders, traps)
and runs a discrete-event simulation of 16 agents per strategy on one shared simulated clock,
emitting protocol-exact `RunEvent`s through the same `RunModel`. The strategy behaviours are
caricatures chosen to exercise every view (registry hot-spot conflicts, merge-queue rebases,
push races, sloppy conflict resolutions, traps caught or landed). The numbers are illustrative, not
benchmark results, and the page says "Simulated data" while it runs.

## Layout

```
src/
  main.ts        boot, run selection, URL state, render loop
  source.ts      LiveSource: WebSocket + polling fallback + overlay polling
  mock.ts        mock bank, simulator, MockSource
  model.ts       RunModel: event folding, cell states, feed, metrics cache
  format.ts      labels, clocks, category order
  dom.ts         tiny element helpers
  views/         grid, column (header + composition), timeline, feed, agents, scoreboard
  styles.css
index.html
scripts/build.mjs
```
