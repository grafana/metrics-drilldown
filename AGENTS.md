# Grafana Metrics Drilldown

> A Grafana app plugin for exploring metrics data.

## Core Documentation

- [Engineering Intent & Philosophy](./docs/project-intent.md): Read this to understand the "Why" behind our code decisions and our stance on abstraction vs. performance.
- [Application Structure](./docs/application-structure.md): Read this to understand the overall application structure and how the different parts of the application are related.

## Usage

This file is an index. Please read the linked files above for specific context during generation.

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Purpose |
|---|---|---|
| Grafana (`grafana-gmd`) | 3001 | Main Grafana instance with the plugin mounted from `./dist` |
| Prometheus (`prometheus-gmd`) | 9099 | Pre-loaded with ~1 hour of static test data (2025-05-26) |
| Grafana Scopes (`grafana-scopes-gmd`) | 3002 | Optional instance with experimental scope feature flags |

### Running the dev environment

Standard commands are in `package.json` scripts and [docs/contributing.md](./docs/contributing.md). Key points:

- `pnpm run server` starts all Docker services (equivalent to `docker compose up --build`).
- `pnpm run dev` starts webpack in watch mode, outputting to `dist/` which is volume-mounted into the Grafana container.
- The Grafana container uses anonymous admin auth — no login is needed.
- App URL: `http://localhost:3001/a/grafana-metricsdrilldown-app/trail`

### Gotchas

- The docker-compose file mounts `../logs-drilldown/dist` for an optional sibling plugin. If that directory does not exist, `docker compose up` will create it as a root-owned empty dir. Create it beforehand (`mkdir -p ../logs-drilldown/dist`) to avoid permission issues.
- The `.env.example` should be copied to `.env` before running Docker services. It sets `GRAFANA_PORT=3001` to avoid conflicts with a local Grafana on 3000.
- Prometheus contains static data (not live-scraping external targets), so metrics time ranges are fixed around 2025-05-26 11:00–12:05. The app defaults to "Last 1 hour" which shows data from that window.
- `pnpm run test` and `pnpm run tdd` run Jest in watch mode; for CI/non-interactive use, run `pnpm run test:ci`.
- Docker must be installed and running for `pnpm run server` and E2E tests. The Docker daemon in Cloud Agent VMs requires `fuse-overlayfs` storage driver and `iptables-legacy`.
