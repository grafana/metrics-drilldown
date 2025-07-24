/**
  We keep track of the Grafana versions that the app supports to enable
  "./scripts/e2e-regen-screenshots.sh" to update all the screenshots automatically.
 
  Thus, it's very important to keep this array in sync with the versions currently supported.
  If you don't know which version are currently supported, check a recent "CI" GitHub action execution and open the logs for the "Dockerized Playwright E2E tests / Resolve Grafana images" step
 */
// TODO: automate (see https://github.com/grafana/plugin-actions/blob/main/e2e-version/README.md)
export const GRAFANA_VERSIONS_SUPPORTED = [
  { image: 'grafana-enterprise', version: '12.1.0' },
  { image: 'grafana-enterprise', version: '12.0.3' },
  { image: 'grafana-enterprise', version: '11.6.4' },
];
