import { test as base, type AppConfigPage, type AppPage } from '@grafana/plugin-e2e';

import { SelectMetricView } from './views/SelectMetricView';
import pluginJson from '../../src/plugin.json';
import { DEFAULT_TIMERANGE } from '../config/constants';

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
