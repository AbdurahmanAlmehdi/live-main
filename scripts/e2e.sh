#!/usr/bin/env bash
# End-to-end smoke test on the local stack: builds the workcell image, starts gitserver +
# integrator + workcells, and runs a small scripted benchmark for each strategy against
# real git, real FUSE overlays and real vitest runs. Fails if any strategy lands < 90%.
set -euo pipefail
cd "$(dirname "$0")/.."
AGENTS=${AGENTS:-4}
TASKS=${TASKS:-16}
WORKCELLS=${WORKCELLS:-2}

pnpm --filter @livemain/sigdiff build >/dev/null
pnpm livemain down >/dev/null 2>&1 || true
pnpm livemain build
for s in live-main pr-flow push-to-branch; do
  pnpm livemain run --strategy "$s" --agents "$AGENTS" --tasks "$TASKS" --workcells "$WORKCELLS" --think-ms 0 | tee ".cache/e2e-$s.log"
done
node -e '
  const fs = require("fs"), path = require("path");
  const dir = "bench/runs";
  const runs = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "metrics.json")))
    .map((d) => JSON.parse(fs.readFileSync(path.join(dir, d, "metrics.json"), "utf8")))
    .sort((a, b) => b.summary.startedAt - a.summary.startedAt).slice(0, 3);
  let ok = true;
  for (const r of runs) {
    const frac = r.metrics.landed / r.metrics.tasks;
    console.log(`${r.metrics.strategy.padEnd(15)} landed ${r.metrics.landed}/${r.metrics.tasks}`);
    if (frac < 0.9) ok = false;
  }
  process.exit(ok ? 0 : 1);
'
