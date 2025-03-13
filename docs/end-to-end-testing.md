# End-to-end testing

- We develop end-to-end tests with [Playwright](https://playwright.dev)
- They are located in the [e2e/tests](../e2e/tests) folder.
- [Playwright fixtures](https://playwright.dev/docs/test-fixtures) (like page objects) are in the [e2e/fixtures](../e2e/fixtures) folder.

Several configurations are provided in the [e2e/config](../e2e/config) folder, depending for:

- launching tests locally or in the CI pipeline,
- providing ways to customize the default configurations easily (number of retries, timeouts, ...)

When developing tests locally, we use a [dockerized Prometheus with static data](../e2e/docker/Dockerfile.prometheus) (2025-02-18T13:30:00.000Z → 2025-02-18T16:15:00.000Z), to have deterministic and predictable tests.

## Develop tests locally

### Setup, only once

Install Playwright with Chromium:

```shell
npm i

npm run e2e:local:prepare
```

### Each time you want to develop a new test

In one terminal window, build the app (with the code watcher):

```shell
npm run dev
```

And in another terminal tab, start Grafana and Prometheus:

```shell
npm run e2e:local:server
```

Then you can start the tests in interactive UI mode (with a built-in watch mode):

```shell
npm run e2e:local:watch
```

You can also run the [code generator](https://playwright.dev/docs/codegen#running-codegen):

```shell
npm run e2e:local:codegen
```

If you write tests that generate screenshots, please read the next section.

### Screenshots testing

When launching the tests locally, the screenshots generated on your machine are ignored by Git. They're just a convenience while developing.

In order to generate the correct screenshots that will always match the ones that will be generated during the CI build, **we have to launch Playwright in Docker**:

```shell
npm run e2e:ci:server:up

npm run e2e:ci:prepare
npm run e2e:ci

# then once finished
npm run e2e:ci:server:down
```

The screenshots are generated in subfolders within the [e2e/tests](../e2e/tests) folder, next to their corresponding tests. They must be commited to Git.

### Regenerating screenshots

Just pass extra arguments to `npm run e2e:ci`, e.g.:

```shell
npm run e2e:ci metrics-list.spec.ts --update-snapshots
```

### CI build

In build time (PR and main branch), we run the same [dockerized Prometheus with static data](../e2e/docker/Dockerfile.prometheus) (2025-02-18T13:30:00.000Z → 2025-02-18T16:15:00.000Z) as in local. This allows us to launch deterministic and predictable tests.

## FAQ

### The build of my PR has failed, how can I see the test reports?

- On your GitHub PR, next to the `CI / E2E tests` job, click on `Details`
- On the GitHub actions page, click on `🏠 Summary`
- At the bottom of the page, click on the `playwright-reports-grafana-*` artifact that you want to download
- Unzip it and open the `test-reports/index.html` page
- Navigate the failing tests to see screenshots and videos of what happened

### The build of my PR has failed because Playwright was just updated, how to fix it?

- Identify the current Playwright version, e.g. `1.50.0`
- Identify the new Playwright version, e.g. `1.51.0`
- In a terminal, execute: `./scripts/upgrade-playwright 1.50.0 1.51.0`
- Launch the E2E tests locally with Docker to verify that the new version works: `npm run e2e:ci:server:up && npm run e2e:ci`
- Push the modified files to the PR
