import { test as base, type AppConfigPage, type AppPage } from '@grafana/plugin-e2e';

import pluginJson from '../../src/plugin.json';
import { DEFAULT_URL_SEARCH_PARAMS } from '../config/constants';
import { MetricsReducerView } from './views/MetricsReducerView';
import { SelectMetricView } from './views/SelectMetricView';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  gotoPage: (path?: string) => Promise<AppPage>;
  selectMetricView: SelectMetricView;
  metricsReducerView: MetricsReducerView;
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
    const selectMetricView = new SelectMetricView(page, DEFAULT_URL_SEARCH_PARAMS);
    await use(selectMetricView);
  },
  metricsReducerView: async ({ page }, use) => {
    const metricsReducerView = new MetricsReducerView(page, DEFAULT_URL_SEARCH_PARAMS);
    await use(metricsReducerView);
  },
});

export { expect } from '@grafana/plugin-e2e';
