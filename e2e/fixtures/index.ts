import { test as base, type AppConfigPage, type AppPage } from '@grafana/plugin-e2e';

import pluginJson from '../../src/plugin.json';
import {
  DEFAULT_STATIC_URL_SEARCH_PARAMS,
  DOCKED_MENU_DOCKED_LOCAL_STORAGE_KEY,
  DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY,
} from '../config/constants';
import { MetricsReducerView } from './views/MetricsReducerView';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  gotoPage: (path?: string) => Promise<AppPage>;
  metricsReducerView: MetricsReducerView;
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
      const urlParams = DEFAULT_STATIC_URL_SEARCH_PARAMS;
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
  metricsReducerView: async ({ page }, use) => {
    const metricsReducerView = new MetricsReducerView(page, DEFAULT_STATIC_URL_SEARCH_PARAMS);
    await use(metricsReducerView);
  },
});

export { expect } from '@grafana/plugin-e2e';
