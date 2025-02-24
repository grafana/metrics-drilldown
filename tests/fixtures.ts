import { test as base, type AppConfigPage, type AppPage } from '@grafana/plugin-e2e';

import {
  DEFAULT_TIMERANGE,
  DOCKED_MENU_DOCKED_LOCAL_STORAGE_KEY,
  DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY,
} from '../e2e/config/constants';
import pluginJson from '../src/plugin.json';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  gotoPage: (path?: string) => Promise<AppPage>;
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
});

export { expect } from '@grafana/plugin-e2e';
