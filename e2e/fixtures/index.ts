import { test as base, type AppConfigPage } from '@grafana/plugin-e2e';

import pluginJson from '../../src/plugin.json';
import { DEFAULT_STATIC_URL_SEARCH_PARAMS } from '../config/constants';
import { MetricSceneView } from './views/MetricSceneView';
import { MetricsReducerView } from './views/MetricsReducerView';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  metricsReducerView: MetricsReducerView;
  metricSceneView: MetricSceneView;
};

export const test = base.extend<AppTestFixture>({
  appConfigPage: async ({ gotoAppConfigPage }, use) => {
    const configPage = await gotoAppConfigPage({
      pluginId: pluginJson.id,
    });
    await use(configPage);
  },
  metricsReducerView: async ({ page }, use) => {
    const metricsReducerView = new MetricsReducerView(page, DEFAULT_STATIC_URL_SEARCH_PARAMS);
    await use(metricsReducerView);
  },
  metricSceneView: async ({ page }, use) => {
    const metricSceneView = new MetricSceneView(page, DEFAULT_STATIC_URL_SEARCH_PARAMS);
    await use(metricSceneView);
  },
});

export { expect } from '@grafana/plugin-e2e';
