import { test as base, type AppConfigPage, type AppPage } from '@grafana/plugin-e2e';
import { Locator } from 'playwright';
import { UI_TEXT } from '../src/constants/ui';

import pluginJson from '../src/plugin.json';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  gotoPage: (path?: string) => Promise<AppPage>;
  getOtelSwitch: () => Promise<Locator>;
};

export const test = base.extend<AppTestFixture>({
  appConfigPage: async ({ gotoAppConfigPage }, use) => {
    const configPage = await gotoAppConfigPage({
      pluginId: pluginJson.id,
    });
    await use(configPage);
  },
  gotoPage: async ({ gotoAppPage }, use) => {
    await use((path) =>
      gotoAppPage({
        path,
        pluginId: pluginJson.id,
      })
    );
  },
  getOtelSwitch: async ({ page }) => {
    return page.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OTEL_LABEL);
  },
});

export { expect } from '@grafana/plugin-e2e';
