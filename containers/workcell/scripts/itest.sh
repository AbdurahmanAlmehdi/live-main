#!/usr/bin/env bash
# Integration test for the workcell image (needs Docker with FUSE support).
#
#   containers/workcell/scripts/itest.sh            # build, unit tests (incl. FUSE), itest
#   SKIP_BUILD=1 SKIP_UNIT=1 .../itest.sh           # reuse the image, only the itest
#   KEEP=1 .../itest.sh                             # leave containers running afterwards
#
# Starts gitserver + integrator + workcell on a private docker network,
# seeds testdata/fixture-repo, and runs the Go driver in itest/ against the
# published ports (go test -tags itest).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # containers/workcell
ROOT="$(cd "$HERE/../.." && pwd)"                          # repo root
IMAGE="${IMAGE:-livemain-workcell:itest}"
NET="${NET:-livemain-itest}"
P="${PREFIX:-lm-itest}"
FUSE_FLAGS=(--device /dev/fuse --cap-add SYS_ADMIN --security-opt apparmor:unconfined)
LOG_DIR="${LOG_DIR:-$(mktemp -d)}"
mkdir -p "$LOG_DIR"

DEPS_DIR=demo-repo
DEMO_DIR=demo-repo
if [[ ! -f "$ROOT/demo-repo/package.json" || ! -f "$ROOT/demo-repo/package-lock.json" ]]; then
  DEPS_DIR=containers/workcell/testdata/deps
fi
if [[ ! -d "$ROOT/demo-repo" ]]; then
  DEMO_DIR=containers/workcell/testdata/fixture-repo
fi

step() { printf '\n==> %s\n' "$*"; }

if [[ -z "${SKIP_BUILD:-}" ]]; then
  step "build image ($IMAGE, deps from $DEPS_DIR)"
  docker build -f "$HERE/Dockerfile" --build-arg DEPS_DIR="$DEPS_DIR" --build-arg DEMO_DIR="$DEMO_DIR" -t "$IMAGE" "$ROOT"
fi

if [[ -z "${SKIP_UNIT:-}" ]]; then
  step "go unit tests inside docker (FUSE enabled)"
  docker build -q -f "$HERE/Dockerfile" --target test -t "$IMAGE-unit" "$ROOT" >/dev/null
  docker run --rm "${FUSE_FLAGS[@]}" "$IMAGE-unit" go test -count=1 ./... | tee "$LOG_DIR/unit.log"
fi

cleanup() {
  if [[ -n "${KEEP:-}" ]]; then
    echo "containers kept: $P-gitserver $P-integrator $P-workcell (network $NET)"
    return
  fi
  for c in gitserver integrator workcell; do
    docker logs "$P-$c" >"$LOG_DIR/$c.log" 2>&1 || true
  done
  docker rm -f "$P-gitserver" "$P-integrator" "$P-workcell" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker rm -f "$P-gitserver" "$P-integrator" "$P-workcell" >/dev/null 2>&1 || true
docker network rm "$NET" >/dev/null 2>&1 || true

step "start gitserver, integrator, workcell"
docker network create "$NET" >/dev/null
docker run -d --name "$P-gitserver" --network "$NET" --network-alias gitserver -p 127.0.0.1::8090 \
  "$IMAGE" serve-git --listen :8090 --root /srv/git --public-url http://gitserver:8090 >/dev/null
# The image ships /seed/fixture-repo and /seed/demo-repo; the demo repo is
# also used for the overhead benchmark when it has tests.
ITEST_DEMO=0
if [[ -d "$ROOT/demo-repo/tests" && -z "${SKIP_DEMO:-}" ]]; then
  ITEST_DEMO=1
fi
docker run -d --name "$P-integrator" --network "$NET" --network-alias integrator "${FUSE_FLAGS[@]}" -p 127.0.0.1::8080 \
  "$IMAGE" serve --listen :8080 --role integrator >/dev/null
# WORKCELL_ENV="LIVEMAIN_FUSE_TIMEOUT=5s ..." passes tuning knobs to the workcell.
WC_ENV=()
for kv in ${WORKCELL_ENV:-}; do WC_ENV+=(-e "$kv"); done
docker run -d --name "$P-workcell" --network "$NET" --network-alias workcell "${FUSE_FLAGS[@]}" -p 127.0.0.1::8080 \
  ${WC_ENV[@]+"${WC_ENV[@]}"} "$IMAGE" serve --listen :8080 >/dev/null

port() { docker port "$1" "$2" | head -n1 | sed 's/.*://'; }
GIT_URL="http://127.0.0.1:$(port "$P-gitserver" 8090)"
INT_URL="http://127.0.0.1:$(port "$P-integrator" 8080)"
WC_URL="http://127.0.0.1:$(port "$P-workcell" 8080)"
for u in "$GIT_URL" "$INT_URL" "$WC_URL"; do
  for _ in $(seq 100); do curl -fsS "$u/health" >/dev/null 2>&1 && break; sleep 0.1; done
  curl -fsS "$u/health" >/dev/null
done

step "integration suite"
set +e
(cd "$HERE" && ITEST_GITSERVER="$GIT_URL" ITEST_INTEGRATOR="$INT_URL" ITEST_WORKCELL="$WC_URL" \
  ITEST_WORKCELL_CONTAINER="$P-workcell" ITEST_DEMO="$ITEST_DEMO" \
  go test -tags itest -count=1 -timeout 30m -v ./itest/) 2>&1 | tee "$LOG_DIR/itest.log"
status=${PIPESTATUS[0]}
set -e

step "summary (logs in $LOG_DIR)"
grep -E '^\s*--- (PASS|FAIL)' "$LOG_DIR/itest.log" || true
grep -E '^(OVERHEAD|READSET)' "$LOG_DIR/itest.log" || true
if [[ $status -eq 0 ]]; then echo "ITEST PASS"; else echo "ITEST FAIL"; fi
exit "$status"
