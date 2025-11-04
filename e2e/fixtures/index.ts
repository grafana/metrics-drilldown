import { test as base, type AppConfigPage } from '@grafana/plugin-e2e';
import { type Locator, type Page } from '@playwright/test';

import pluginJson from '../../src/plugin.json';
import { DEFAULT_STATIC_URL_SEARCH_PARAMS } from '../config/constants';
import { MetricSceneView } from './views/MetricSceneView';
import { MetricsReducerView } from './views/MetricsReducerView';
import { getGrafanaVersion } from '../config/playwright.config.common';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  expectScreenshotInCurrentGrafanaVersion: (
    locator: Locator | Page,
    fileName: string,
    options?: Record<string, any>
  ) => Promise<void>;
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
  expectScreenshotInCurrentGrafanaVersion: async ({}, use) => {
    const expectToHaveScreenshot: AppTestFixture['expectScreenshotInCurrentGrafanaVersion'] = async (
      locator,
      fileName,
      options
    ) => {
      const grafanaVersion = getGrafanaVersion('minor');
      if (!grafanaVersion) {
        throw new Error('Cannot determine Grafana version, which is required for screenshot testing!');
      }

      const expectedFileName = `${grafanaVersion}-${fileName}`;
      /* eslint-disable no-restricted-syntax */
      console.log(`Comparing screenshot against expected file: ${expectedFileName}`);
      await base.expect(locator).toHaveScreenshot(expectedFileName, { ...options, maxDiffPixelRatio: 0 });
    };

    await use(expectToHaveScreenshot);
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
