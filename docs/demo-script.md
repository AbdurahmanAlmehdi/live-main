# Demo script (5–10 min)

The arc from the brainstorm notes: frame the problem, launch the swarms side by side,
inject a change order around minute 3, show the baselines stall while Live Main ripples
and continues, end on the scoreboard.

## Setup (before recording)

```bash
pnpm setup
pnpm livemain compare --agents 8 --workcells 3 --tasks 120 --think-ms 1500 --keep-serving
# or the simulated race for rehearsal: open http://localhost:5180/?mock=1 (pnpm --filter @livemain/dashboard dev)
```

Open the dashboard at http://localhost:8787 in race view (three columns: live-main,
pr-flow, push-to-branch). For a recorded race where all three run at once, start three
`livemain run` processes on different ports, or use the mock mode for the narrative
and the real compare run for the scoreboard.

## 0:00 – 1:00 · The problem

- One slide: GitHub flow for 300 agents → late detection, re-application, the race.
- Read-write staleness: "A read how `coerce.ts` works, B changed it, both merge
  cleanly, A is wrong." Git can't see it.

## 1:00 – 2:00 · The idea

- "One shared live main. Each agent is a thin overlay on it. The filesystem tells the
  agent what moved under it. Merging is promoting an overlay."
- Show `containers/workcell` in one sentence: FUSE union of `git tree @ pin` + upper dir,
  every `open()` logged → read set for free (12 of 387 files for a single-function test).

## 2:00 – 3:00 · Launch

- The grid starts all `#NAME?`. Cells flip green as agents land.
- Point at the timeline: live-main versions land with the **auto-merged** badge on
  `registry.ts` (every agent appends a line; zero rebases).
- Point at pr-flow: `needs-rebase` / `push-rejected` in its feed, the same registry
  conflict over and over.

## 3:00 – 5:00 · The change order

- `co-arity-tuple` releases (feed shows "Change order released"): `FormulaFunction`
  `{minArgs,maxArgs}` → `arity: [min,max]`.
- Live Main: interrupts fan out only to agents whose read set includes `types.ts` /
  `evaluate.ts`; they adapt in place and keep landing.
- Baselines: agents that branched before the change find out at merge time.

## 5:00 – 6:30 · The trap

- A trap (e.g. `trap-DECIMAL`) changes a shared helper's behavior; its own tests pass and
  the diff merges cleanly in git.
- Live Main: the promotion runs the landed tests whose recorded read sets touch the
  helper → "Breakage caught before landing" in the feed; the agent makes the change
  opt-in and lands.
- push-to-branch: the regression lands; the grid shows the pink `#REF!` cells.

## 6:30 – 8:00 · Scoreboard and scale

- Scoreboard: time to all-green, landings/min, wasted agent-minutes, rebases,
  breakages caught vs landed.
- Synthetic coordinator test (`pnpm synth --agents 10000`): 10k scripted agents, the
  coordinator's p99 latency, clearly labeled synthetic.

## 8:00 – 9:00 · Built on Cloudflare

- Coordinator, agents and runs are Durable Objects; workcells are Containers with FUSE
  under the `durable_object` scheduling policy; main is an Artifacts repo you can
  `git clone`; the dashboard is a Worker with WebSocket hibernation.
