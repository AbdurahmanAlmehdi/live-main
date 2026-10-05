Live Main
Step 2: build the design system for the direction I chose ([direction name]) as one reference
page (a self-contained HTML file), with light and dark versions:

* Colour tokens with semantic names: surface (canvas, raised, sunken, overlay), border, text
  (primary, secondary, muted, on-accent, link), accent, focus ring; the product's states (live
  main, overlay-written, read-set, queued, working, testing, checkpointing, interrupted,
  guarded, ready, landed, gave-up, stopped, error); notice severities (interrupt, review);
  change classes (additive, body, signature); diff (added, removed, line and word highlight);
  budget (ok, near, over). Show each colour's contrast ratio against the surface it sits on.
* Type scale for the UI sans and the monospace (code, paths, hashes, versions), with line
  heights, including a style for large live numbers (counts, cost, main's version) that uses
  tabular figures so updates don't jitter.
* Spacing, radii, border and elevation tokens; layout grid; row heights for compact and
  comfortable lists.
* Motion tokens: durations, easings, and when motion is used (a landing arrives, a status
  changes, a notice appears, a counter ticks), what never animates, and the reduced-motion
  version of each.
* Icons: the set you chose, and one status icon per agent state, landing type and notice type,
  always shown with its label.
* Components: status chip (every agent state), version pill and live-main indicator, file tree
  row with overlay markers (written by N agents, read by N), file view header, diff (unified
  and split, line numbers, word highlight, collapsed hunks, change-class tag per file),
  timeline row (agent landing, human push from GitHub, change order), notice card (interrupt
  and review, with diff excerpt and what the agent did), agent row (task, provider and model or
  external agent, status, cost, last action), swarm progress summary (landed / running /
  queued / guarded / gave up), budget meter, CLI snippet with copy, API key field (write-only,
  masked, test button), model-mix rule row, primary, secondary and danger buttons, text input,
  select, tabs, segmented control, table, command palette, toast, and empty, loading and error
  states.

Use the Step 1 sample data in every component example.

Name every token so it can map one to one onto CSS custom properties (light and dark values)
and a Tailwind theme config. Include both as code at the end of the page, plus the tokens as a
JSON file in the W3C design-tokens format. Then stop.
