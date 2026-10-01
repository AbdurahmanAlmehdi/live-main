# Headless LibreOffice Calc for the oracle cross-check (oracle/libreoffice.ts).
FROM debian:bookworm-slim
RUN apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends libreoffice-calc-nogui \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
