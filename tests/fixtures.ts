import { test as base, type AppConfigPage, type AppPage } from '@grafana/plugin-e2e';
import { type Locator } from '@playwright/test';

import { ROUTES } from '../src/constants';
import { UI_TEXT } from '../src/constants/ui';
import pluginJson from '../src/plugin.json';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  gotoPage: (path?: string) => Promise<AppPage>;
  otelSwitch: Locator;
  navigateToTrail: () => Promise<void>;
  getMetricPanel: (title: string) => Promise<Locator>;
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
  otelSwitch: async ({ page }, use) => {
    const switchElement = page.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OTEL_LABEL);
    await use(switchElement);
  },
  navigateToTrail: async ({ gotoPage }, use) => {
    await use(async () => {
      await gotoPage(`/${ROUTES.Trail}`);
    });
  },
  getMetricPanel: async ({ page }, use) => {
    await use(async (title: string) => {
      return page.getByTestId(`data-testid Panel header ${title}`);
    });
  },
});

export { expect } from '@grafana/plugin-e2e';
