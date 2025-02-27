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

// import { test as base, expect } from '@playwright/test';

// import { DEFAULT_EXPLORE_PROFILES_URL_PARAMS } from '../config/constants';
// import { AdHocViewPage } from './pages/AdHocViewPage';
// import { ExploreProfilesPage } from './pages/ExploreProfilesPage';
// import { SettingsPage } from './pages/SettingsPage';

// type Fixtures = {
//   exploreProfilesPage: ExploreProfilesPage;
//   adHocViewPage: AdHocViewPage;
//   settingsPage: SettingsPage;
// };

// type Options = {
//   failOnUncaughtExceptions: boolean;
// };

// const withExceptionsAssertion = async ({ page, failOnUncaughtExceptions, use }, fixture) => {
//   if (!failOnUncaughtExceptions) {
//     return await use(fixture);
//   }

//   const exceptions: Error[] = [];

//   page.addListener('pageerror', (error) => {
//     exceptions.push(error);
//   });

//   await use(fixture);

//   expect(exceptions, `${exceptions.length} uncaught exception(s) encountered!`).toEqual([]);
// };

// export const test = base.extend<Options & Fixtures>({
//   // fixture option accessible in every test case or fixture (default value = false)
//   failOnUncaughtExceptions: [false, { option: true }],
//   exploreProfilesPage: async ({ page, failOnUncaughtExceptions }, use) => {
//     await withExceptionsAssertion(
//       { page, failOnUncaughtExceptions, use },
//       new ExploreProfilesPage(page, DEFAULT_EXPLORE_PROFILES_URL_PARAMS)
//     );
//   },
//   adHocViewPage: async ({ page, failOnUncaughtExceptions }, use) => {
//     await withExceptionsAssertion({ page, failOnUncaughtExceptions, use }, new AdHocViewPage(page));
//   },
//   settingsPage: async ({ page, failOnUncaughtExceptions }, use) => {
//     await withExceptionsAssertion({ page, failOnUncaughtExceptions, use }, new SettingsPage(page));
//   },
// });

// export { expect } from '@playwright/test';
