import { type Page } from '@playwright/test';

import {
  GRAFANA_RULER_RULES_URL,
  SLO_RESOURCE_URL,
} from '../../../src/MetricsReducer/list-controls/MetricsSorter/fetchers/shared';
import { expect, test } from '../../fixtures';

const TRACKED_METRIC = 'handler_duration_seconds_count';
const SECOND_TRACKED_METRIC = 'jaeger_tracer_finished_spans_total';
const UNTRACKED_METRIC = 'memberlist_client_cas_success_total';

async function enableSloFlag(page: Page) {
  await page.route('**/ofrep/v1/evaluate/flags', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        flags: [
          {
            key: 'drilldown.metrics.slo_tracked_metrics',
            value: true,
            variant: 'enabled',
            reason: 'STATIC',
          },
        ],
      },
    });
  });
}

async function injectSloPlugin(page: Page) {
  await page.addInitScript(() => {
    const inject = (bootData: Record<string, any>) => {
      bootData.settings ??= {};
      bootData.settings.apps ??= {};
      bootData.settings.apps['grafana-slo-app'] = {
        id: 'grafana-slo-app',
        path: '',
        version: 'test-version',
        preload: false,
        angular: { detected: false, hideDeprecation: false },
        loadingStrategy: 'script',
        dependencies: {
          grafanaVersion: '*',
          plugins: [],
          extensions: { exposedComponents: [] },
        },
        extensions: {
          addedComponents: [],
          addedFunctions: [],
          addedLinks: [],
          exposedComponents: [],
          extensionPoints: [],
        },
      };
      return bootData;
    };

    const target = window as typeof window & { grafanaBootData?: Record<string, any> };
    if (target.grafanaBootData) {
      inject(target.grafanaBootData);
      return;
    }

    Object.defineProperty(target, 'grafanaBootData', {
      configurable: true,
      set(value: Record<string, any>) {
        Object.defineProperty(target, 'grafanaBootData', {
          configurable: true,
          writable: true,
          value: inject(value),
        });
      },
    });
  });
}

async function stubSloDefinitions(page: Page, status = 200) {
  await page.route(`**${SLO_RESOURCE_URL}`, async (route) => {
    if (status !== 200) {
      await route.fulfill({ status, contentType: 'application/json', json: { message: 'unavailable' } });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      json: {
        slos: [
          {
            uuid: 'slo-burning',
            destinationDatasource: { uid: 'gdev-prometheus', type: 'prometheus' },
            query: {
              type: 'ratio',
              ratio: {
                successMetric: { prometheusMetric: TRACKED_METRIC },
                totalMetric: { prometheusMetric: SECOND_TRACKED_METRIC },
              },
            },
          },
          {
            uuid: 'slo-other-datasource',
            destinationDatasource: { uid: 'other-prometheus', type: 'prometheus' },
            query: {
              type: 'freeform',
              freeform: { query: UNTRACKED_METRIC },
            },
          },
        ],
      },
    });
  });

  await page.route(`**${GRAFANA_RULER_RULES_URL}*`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        status: 'success',
        data: {
          groups: [
            {
              name: 'slo-burn',
              rules: [
                {
                  type: 'alerting',
                  name: 'SLO burn',
                  query: 'grafana_slo_sli_5m > 0',
                  state: 'firing',
                  labels: { grafana_slo_uuid: 'slo-burning', grafana_slo_severity: 'critical' },
                },
              ],
            },
          ],
        },
      },
    });
  });
}

test.describe('SLO-tracked metrics optional integration', () => {
  test('keeps SLO controls hidden when the plugin is absent', async ({ page, metricsReducerView }) => {
    await enableSloFlag(page);
    let resourceRequests = 0;
    await page.route(`**${SLO_RESOURCE_URL}`, async (route) => {
      resourceRequests++;
      await route.abort();
    });

    await metricsReducerView.goto();
    await metricsReducerView.assertMetricsList();

    await expect(metricsReducerView.getSloTrackedChip()).toHaveCount(0);
    expect(resourceRequests).toBe(0);
  });

  test('shows badges, filters the list, and restores URL state for installed SLO', async ({
    page,
    metricsReducerView,
  }) => {
    await enableSloFlag(page);
    await injectSloPlugin(page);
    await stubSloDefinitions(page);

    await metricsReducerView.goto();
    await expect(metricsReducerView.getSloTrackedChip()).toBeVisible();
    await expect(metricsReducerView.getSloTrackedChip()).toContainText('SLO-tracked (2)');
    await metricsReducerView.quickSearch.enterText(TRACKED_METRIC);
    await expect(metricsReducerView.getSloTrackedChip()).toContainText('SLO-tracked (1)');
    await expect(metricsReducerView.getSloTrackedBadge(TRACKED_METRIC)).toBeVisible();
    await metricsReducerView.quickSearch.clear();
    await expect(metricsReducerView.getSloTrackedChip()).toContainText('SLO-tracked (2)');

    await metricsReducerView.toggleSloTrackedFilter();
    await expect(metricsReducerView.getPanelByTitle(TRACKED_METRIC)).toBeVisible();
    await expect(metricsReducerView.getPanelByTitle(SECOND_TRACKED_METRIC)).toBeVisible();
    await expect(metricsReducerView.getPanelByTitle(UNTRACKED_METRIC)).toHaveCount(0);
    await expect(page).toHaveURL(/filter-slo-tracked=true/);

    await page.reload();
    await expect(metricsReducerView.getSloTrackedChip()).toHaveAttribute('aria-pressed', 'true');
    await expect(metricsReducerView.getPanelByTitle(UNTRACKED_METRIC)).toHaveCount(0);

    await metricsReducerView.toggleSloTrackedFilter();
    await expect(metricsReducerView.getSloTrackedChip()).toHaveAttribute('aria-pressed', 'false');
    await metricsReducerView.sidebar.toggleButton('Group by labels');
    await metricsReducerView.sidebar.selectGroupByLabel('job');
    await metricsReducerView.assertMetricsGroupByList();
    const trackedMetricGroup = metricsReducerView
      .getMetricsGroupByList()
      .getByTestId('job-ride-sharing-app-metrics-group');
    await trackedMetricGroup.scrollIntoViewIfNeeded();
    await expect(metricsReducerView.getSloTrackedBadge(TRACKED_METRIC)).toBeVisible();
  });

  test('clears stale URL filtering when the SLO API fails', async ({ page, metricsReducerView }) => {
    await enableSloFlag(page);
    await injectSloPlugin(page);
    await stubSloDefinitions(page, 500);

    await metricsReducerView.goto(new URLSearchParams({ 'filter-slo-tracked': 'true' }));
    await metricsReducerView.assertMetricsList();

    await expect(metricsReducerView.getSloTrackedChip()).toHaveCount(0);
    await expect(page).not.toHaveURL(/filter-slo-tracked=true/);
    await metricsReducerView.quickSearch.enterText(UNTRACKED_METRIC);
    await expect(metricsReducerView.getPanelByTitle(UNTRACKED_METRIC)).toBeVisible();
  });
});
