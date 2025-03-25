import { test as base, type AppConfigPage, type AppPage } from '@grafana/plugin-e2e';
import { type Locator } from '@playwright/test';

import { ROUTES } from '../../src/constants';
import pluginJson from '../../src/plugin.json';
import {
  DEFAULT_TIMERANGE,
  DOCKED_MENU_DOCKED_LOCAL_STORAGE_KEY,
  DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY,
} from '../config/constants';
import { SelectMetricView } from './views/SelectMetricView';
import { UI_TEXT } from '../../src/constants/ui';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  gotoPage: (path?: string) => Promise<AppPage>;
  selectMetricView: SelectMetricView;
};

export const test = base.extend<AppTestFixture>({
  appConfigPage: async ({ gotoAppConfigPage }, use) => {
    const configPage = await gotoAppConfigPage({
      pluginId: pluginJson.id,
    });
    await use(configPage);
  },
  gotoPage: async ({ gotoAppPage, page }, use) => {
    await use(async (path) => {
      const urlParams = new URLSearchParams({ ...DEFAULT_TIMERANGE });
      const url = `${path}?${urlParams.toString()}`;

      await page.addInitScript(
        (keys) => {
          keys.forEach((key) => {
            window.localStorage.setItem(key, 'false');
          });
        },
        [DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY, DOCKED_MENU_DOCKED_LOCAL_STORAGE_KEY]
      );

      const appPage = await gotoAppPage({
        path: url,
        pluginId: pluginJson.id,
      });

      return appPage;
    });
  },
  selectMetricView: async ({ page }, use) => {
    const selectMetricView = new SelectMetricView(page, new URLSearchParams({ ...DEFAULT_TIMERANGE }));
    await use(selectMetricView);
  },
});

export { expect } from '@grafana/plugin-e2e';
