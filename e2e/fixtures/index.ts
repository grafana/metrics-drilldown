import { test as base, type AppConfigPage, type AppPage } from '@grafana/plugin-e2e';
import { type Locator } from '@playwright/test';

import { ROUTES } from '../../src/constants';
import pluginJson from '../../src/plugin.json';
import { DEFAULT_TIMERANGE } from '../config/constants';
import { SelectMetricView } from './views/SelectMetricView';
import { UI_TEXT } from '../../src/constants/ui';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  gotoPage: (path?: string) => Promise<AppPage>;
  selectMetricView: SelectMetricView;
  otelSwitch: Locator;
  navigateToTrail: () => Promise<void>;
  getMetricPanel: (title: string) => Promise<Locator>;
  forEachTest: void;
};

export const test = base.extend<AppTestFixture>({
  appConfigPage: async ({ gotoAppConfigPage }, use) => {
    const configPage = await gotoAppConfigPage({
      pluginId: pluginJson.id,
    });
    await use(configPage);
  },
  forEachTest: [
    async ({ page }, use) => {
      // This code runs before every test.
      await page.goto('http://localhost:8000');
      await use();
      // This code runs after every test.
      console.log('Last URL:', page.url());
    },
    { auto: true },
  ],
  gotoPage: async ({ gotoAppPage }, use) => {
    await use((path) =>
      gotoAppPage({
        path,
        pluginId: pluginJson.id,
      })
    );
  },
  selectMetricView: async ({ page }, use) => {
    const selectMetricView = new SelectMetricView(page, new URLSearchParams({ ...DEFAULT_TIMERANGE }));
    await use(selectMetricView);
  },
});

export { expect } from '@grafana/plugin-e2e';
