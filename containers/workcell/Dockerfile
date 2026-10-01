# syntax=docker/dockerfile:1.7
# Build context: the repository root.
#   docker build -f containers/workcell/Dockerfile -t livemain-workcell .
# DEPS_DIR: directory holding the package.json + package-lock.json installed
# into /deps (the demo repo; containers/workcell/testdata/deps as fallback).
# DEMO_DIR: directory shipped at /seed/demo-repo for POST /seed (the demo
# repo; containers/workcell/testdata/fixture-repo as fallback).
ARG DEPS_DIR=demo-repo
ARG DEMO_DIR=demo-repo
ARG MERGIRAF_VERSION=0.20.0

FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY containers/workcell/go.mod containers/workcell/go.sum ./
RUN go mod download
COPY containers/workcell/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/workcell ./cmd/workcell

# `docker build --target test` + `docker run --device /dev/fuse --cap-add SYS_ADMIN`
# runs the Go unit tests including the FUSE ones.
FROM build AS test
RUN apt-get update && apt-get install -y --no-install-recommends fuse3 nodejs \
    && rm -rf /var/lib/apt/lists/*
CMD ["go", "test", "-count=1", "./..."]

FROM debian:bookworm-slim AS mergiraf
ARG MERGIRAF_VERSION
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    case "${TARGETARCH:-$(dpkg --print-architecture)}" in \
      amd64) arch=x86_64 ;; arm64) arch=aarch64 ;; *) echo "unsupported arch"; exit 1 ;; \
    esac; \
    curl -fsSL "https://codeberg.org/mergiraf/mergiraf/releases/download/v${MERGIRAF_VERSION}/mergiraf_${arch}-unknown-linux-gnu.tar.gz" \
      | tar -xz -C /usr/local/bin mergiraf; \
    /usr/local/bin/mergiraf --version

FROM node:20-bookworm-slim AS deps
ARG DEPS_DIR
WORKDIR /deps
COPY ${DEPS_DIR}/package.json ${DEPS_DIR}/package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

FROM node:20-bookworm-slim
ARG DEMO_DIR
RUN apt-get update && apt-get install -y --no-install-recommends git fuse3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /deps/node_modules /deps/node_modules
# vite writes its bundled config next to node_modules; tests run as per-workspace uids.
RUN mkdir -p /deps/node_modules/.vite-temp && chmod 1777 /deps/node_modules/.vite-temp
COPY --from=mergiraf /usr/local/bin/mergiraf /usr/local/bin/mergiraf
# The real sigdiff bundle is copied when packages/sigdiff/dist exists (the
# bracket globs make it optional); the stub is always available for tests.
COPY containers/workcell/testdata/sigdiff-stub.cjs packages/sigdiff/dis[t]/sigdiff.cj[s] /opt/livemain/
# Seed sources for POST /seed (node_modules excluded via Dockerfile.dockerignore).
COPY ${DEMO_DIR}/ /seed/demo-repo/
COPY containers/workcell/testdata/fixture-repo/ /seed/fixture-repo/
COPY --from=build /out/workcell /usr/local/bin/workcell
ENV LIVEMAIN_DATA=/var/livemain \
    LIVEMAIN_DEPS=/deps/node_modules \
    LIVEMAIN_SIGDIFF=/opt/livemain/sigdiff.cjs
EXPOSE 8080 8090
ENTRYPOINT ["workcell"]
CMD ["serve", "--listen", ":8080"]
