import { test as base, type AppConfigPage, type AppPage } from '@grafana/plugin-e2e';

import pluginJson from '../../src/plugin.json';
import {
  DEFAULT_TIMERANGE,
  DOCKED_MENU_DOCKED_LOCAL_STORAGE_KEY,
  DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY,
} from '../config/constants';
import { TrailView } from './views/TrailView';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  gotoPage: (path?: string) => Promise<AppPage>;
  trailView: TrailView;
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
  trailView: async ({ page }, use) => {
    const urlParams = new URLSearchParams({ ...DEFAULT_TIMERANGE });
    const trailView = new TrailView(page, urlParams);

    await use(trailView);
  },
});

export { expect } from '@grafana/plugin-e2e';
