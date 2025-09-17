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
npm i

npm run e2e:prepare
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
npm run dev
```

And in another terminal tab, start Grafana and Prometheus:

```shell
npm run e2e:server
```

Then you can start the tests in interactive UI mode (with a built-in watch mode):

```shell
npm run e2e:watch
```

You can also run the [code generator](https://playwright.dev/docs/codegen#running-codegen):

```shell
npm run e2e:codegen -- http://localhost:3001
```

If you want to write tests that perform [visual comparisons](https://playwright.dev/docs/test-snapshots), check the next section.

### Screenshots testing

Screenshot testing with Playwright allows us to catch visual regressions by comparing rendered UI (like timeseries panels) against known-good reference images. This section explains how to work with screenshots in both local development and CI environments.

#### Overview

Screenshots are generated using [Playwright's snapshot testing capabilities](https://playwright.dev/docs/test-snapshots) and stored in dedicated snapshot directories next to their corresponding test files (e.g., `e2e/tests/metric-scene-view.spec.ts-snapshots/`).

**Local Development**: Screenshots generated on your machine are ignored by Git and serve as a development convenience for visual debugging.

**CI Environment**: Screenshots are generated in Docker containers and committed to Git to ensure consistent rendering across different environments and Grafana versions.

#### Local vs CI Screenshot Workflow

Since our plugin supports multiple Grafana versions (e.g., v12.1.0 and v11.6.4), and visual elements may differ between versions, we need a robust screenshot generation process:

1. **Generate version-specific or version-independent screenshots** depending on the use case
2. **Use Docker locally with static Prometheus data** to match the CI environment exactly
3. **Commit generated screenshots to Git** for CI comparison

#### A. Screenshot API Methods

Choose the appropriate method based on whether your UI differs between Grafana versions:

##### A1. Version-Independent Screenshots

Use the native Playwright method for UI elements that look identical across Grafana versions:

```typescript
await expect(locator).toHaveScreenshot('metric-scene-main-viz.png');
```

**When to use**: Simple components (like single timeseries panels) that render consistently across versions.

**File naming**: Standard Playwright naming (e.g., `metric-scene-main-viz-chromium-linux.png`)

##### A2. Version-Specific Screenshots

Use our custom [expectToHaveScreenshot](./e2e/fixtures/index.ts) fixture for UI elements that differ between Grafana versions:

```typescript
await expectToHaveScreenshot(locator, 'metric-scene-breakdown-all-panels-list.png');
```

**When to use**: Complex layouts, UI panels, or components that vary between Grafana versions.

**File naming**: Prefixed with version (e.g., `12-1-0-metric-scene-breakdown-all-panels-list-chromium-linux.png`)

> [!NOTE]
> The custom `expectToHaveScreenshot` fixture automatically handles version prefixing and ensures screenshots are generated for each supported Grafana version.

#### B. Generating Screenshots with Docker

##### Single Version Generation

To generate screenshots for a specific Grafana version:

```shell
GRAFANA_IMAGE=grafana-enterprise GRAFANA_VERSION=12.1.0 npm run e2e:ci
```

This generates screenshots only for Grafana Enterprise v12.1.0.

##### All Supported Versions

To generate screenshots for all supported Grafana versions:

```shell
./scripts/e2e-gen-all-screenshots.sh
```

This script automatically generates screenshots for each version defined in the [e2e/config/grafana-versions-supported.ts](../e2e/config/grafana-versions-supported.ts).

> [!IMPORTANT]
> Make sure that the GRAFANA_VERSIONS_SUPPORTED array in e2e/config/grafana-versions-supported.ts is up-to-date.
> If you don't know which versions are currently supported, go to GitHub, check a recent "CI" job execution and open the logs for the "Dockerized Playwright E2E tests / Resolve Grafana images" step to see which versions are currently supported.

#### C. Complete Workflow Example

Here's a typical workflow for adding screenshot tests:

1. **Write your test** with screenshot assertions:

   ```typescript
   test('Simple and complex sidebars', async ({ page, expectToHaveScreenshot }) => {
     // version-independent UI
     await expect(page.locator('[data-testid="simple-sidebar"]')).toHaveScreenshot('simple-sidebar.png');

     // version-specific UI
     await expectToHaveScreenshot(page.locator('[data-testid="complex-sidebar"]'), 'sidebar.png');
   });
   ```

2. **Generate screenshots locally** using Docker:

   ```shell
   ./scripts/e2e-gen-all-screenshots.sh "-g 'Simple and complex sidebars'"
   ```

3. **Review generated screenshots** in the test snapshot directories

4. **Commit the screenshots** to Git for CI validation

5. **Push your changes** - CI will validate screenshots match exactly

This ensures your visual tests work consistently across all supported Grafana versions.

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
- Launch the E2E tests locally with Docker to verify that the new version works: `npm run e2e:ci`
- Push the modified files to the PR

### When launching the tests, I see more Prometheus metrics than expected

- Make sure that there are no other local services that are sending metrics to Prometheus
- Only the services described in the [docker-compose.yaml](../docker-compose.yaml) file should be running
