import path from 'node:path';

import { config, getGrafanaUrl } from './playwright.config.common';

export default config({
  // we use the "list" reporter instead of the "dot" one, because it doesn't show in GitHub actions logs
  testDir: path.join(process.cwd(), 'e2e', 'smoketests'),
  baseURL: process.env.GRAFANA_URL || getGrafanaUrl(),
  reporter: [['list'], ['html', { outputFolder: '../test-reports', open: 'never' }], ['github']],
  retries: 1,
  forbidOnly: true,
  workers: 2,
});
