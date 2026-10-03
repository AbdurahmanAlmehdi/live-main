#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
echo "== A: full bank, 16 agents, seed 1"; date
pnpm livemain compare --agents 16 --workcells 4 --tasks 400 --think-ms 1500 --seed 1 --port 8787 > bench/runs/suite-A.log 2>&1
for s in 2 3; do
  echo "== B: 60 tasks, 8 agents, seed $s"; date
  pnpm livemain compare --agents 8 --workcells 3 --tasks 60 --think-ms 1500 --seed $s --port 8787 > bench/runs/suite-B$s.log 2>&1
done
echo "== done"; date
