# End-to-end testing

- We develop end-to-end tests with [Playwright](https://playwright.dev)
- They are located in the [e2e/tests](../e2e/tests) folder.
- [Playwright fixtures](https://playwright.dev/docs/test-fixtures) (like page objects) are in the [e2e/fixtures](../e2e/fixtures) folder.

Several configurations are provided in the [e2e/config](../e2e/config) folder, depending for:

- launching tests locally or in the CI pipeline,
- providing ways to customize the default configurations easily (number of retries, timeouts, ...)

When developing tests locally, we use a [dockerized Prometheus with static data](../e2e/docker/Dockerfile.prometheus-static-data) to have deterministic and predictable tests.

## Developing tests

### Setup, only once

Install Playwright with Chromium:

```shell
pnpm install

pnpm run e2e:prepare
```

Make sure your `.env` file in the root folder contains these environment variables:

- `GRAFANA_IMAGE`
- `GRAFANA_VERSION`
- `GRAFANA_PORT`
- `GRAFANA_SCOPES_PORT`

An easy way to do this is to open [env.example](../.env.example) and save it as `.env`.

### Each time you want to develop a new test

In one terminal window, build the app (with the code watcher):

```shell
pnpm run dev
```

And in another terminal tab, start Grafana and Prometheus:

```shell
pnpm run e2e:server
```

Then you can start the tests in interactive UI mode (with a built-in watch mode):

```shell
pnpm run e2e:watch
```

You can also run the [code generator](https://playwright.dev/docs/codegen#running-codegen):

```shell
pnpm run e2e:codegen -- http://localhost:3001
```

## FAQ

### The build of my PR has failed, how can I see the test reports?

- On your GitHub PR, click on the `Checks` tab
- In the left sidebar, click on the `CI`job, you should be in its `🏠 Summary` section
- Scroll to the bottom of the page, click on the `playwright-report-grafana-*` artifact that you want to download
- Unzip it and open the `test-reports/index.html` page
- Navigate the failing tests to see screenshots and videos of what happened

### The build of my PR has failed because Playwright was just updated, how to fix it?

- Identify the current Playwright version, e.g. `1.50.0`
- Identify the new Playwright version, e.g. `1.51.0`
- In a terminal, execute: `./scripts/upgrade-playwright.sh 1.50.0 1.51.0`
- Launch the E2E tests locally to verify that the new version works: `pnpm run e2e`
- Push the modified files to the PR

### When launching the tests, I see more Prometheus metrics than expected

- Make sure that there are no other local services that are sending metrics to Prometheus
- Only the services described in the [docker-compose.yaml](../docker-compose.yaml) file should be running
