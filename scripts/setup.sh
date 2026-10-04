#!/usr/bin/env bash
# One-command setup for Live Main: installs dependencies, builds the TypeScript tools,
# the dashboard and the workcell container image. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "error: $1 is required ($2)"; exit 1; }; }
need node "Node.js >= 20"
need pnpm "npm i -g pnpm@10"
need docker "Docker Desktop or another engine with FUSE support"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || { echo "error: Node.js >= 20 required"; exit 1; }
docker info >/dev/null 2>&1 || { echo "error: the Docker daemon is not running"; exit 1; }

echo "==> installing workspace dependencies"
pnpm install --frozen-lockfile=false

echo "==> building sigdiff (bundled into the workcell image)"
pnpm --filter @livemain/sigdiff build

echo "==> installing demo repo dependencies (for local validation)"
(cd demo-repo && npm ci --no-audit --no-fund)

if [ -f apps/dashboard/package.json ]; then
  echo "==> building the dashboard"
  pnpm --filter @livemain/dashboard build
fi

echo "==> building the web app"
pnpm --filter @livemain/web build

echo "==> building the workcell image (Go livefs + mergiraf + node + demo repo deps)"
pnpm livemain build

cat <<'MSG'

Ready. Next:
  pnpm livemain serve                                                # the web app + API at http://localhost:8787
  pnpm livemain run --strategy live-main --agents 6 --tasks 40      # one strategy, scripted agents
  pnpm livemain compare --agents 8 --tasks 60                        # all three strategies + scoreboard
  ANTHROPIC_API_KEY=... pnpm livemain run --mode llm --agents 8      # real Claude Haiku 4.5 agents
  pnpm synth --agents 10000 --duration 60                            # synthetic coordinator stress test
Dashboard: http://localhost:8787 while a run is active (add --keep-serving to keep it up).
MSG
