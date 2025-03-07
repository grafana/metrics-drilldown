# Grafana Metrics Drilldown

[Grafana Metrics Drilldown](https://grafana.com/docs/grafana/latest/explore/simplified-exploration/metrics) provides a query-less experience for browsing Prometheus-compatible metrics. Quickly find related metrics without writing PromQL queries.

## Installing in your own Grafana instance

Grafana Metrics Drilldown will be preinstalled by default in all Grafana instances in the near future.

In the meantime, you can install the plugin from the `main` branch using [`grafana-cli`](https://grafana.com/docs/grafana/latest/cli/#plugins-commands):

```bash
grafana cli plugins install grafana-metricsdrilldown-app
```

## Development

### Frontend

#### Prerequisites

- Node.js 22+
- Docker Desktop

#### Install dependencies

```bash
npm install
```

#### Run in watch mode

Begin by starting the Grafana server in a separate terminal:

```bash
npm run server
```

Then, run the plugin in watch mode:

```bash
npm run dev
```

#### Running tests

##### Unit tests

```bash
# Runs the tests and watches for changes
npm run test

# Exits after running all the tests
npm run test:ci
```

##### End-to-end tests

First, ensure that the Grafana server is running:

```bash
npm run server
```

Then, run the E2E tests:

```bash
npm run e2e
```

#### Run the linter

To see lint errors, run:

```bash
npm run lint
```

To fix lint errors automatically, run:

```bash
npm run lint:fix
```

### Configuration

If you'd like to customize the exposed port of the Grafana instance that is used for development (created with `npm run server`), you can do so by setting the `GRAFANA_PORT` environment variable in the `.env` file. For reference, see `.env.example`.

```bash
# .env
GRAFANA_PORT=3001
```
