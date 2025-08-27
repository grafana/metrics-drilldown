import { expect, test } from '../../fixtures';

type CategoryTest = {
  category: 'gauges and counters' | 'histograms' | 'others';
  namesAndPresets: Array<[string, string, string[]]>;
};

const TEST_DATA: CategoryTest[] = [
  {
    category: 'gauges and counters',
    namesAndPresets: [
      // gauge with no unit
      ['go_goroutines', 'Standard deviation', []],
      // gauge with "bytes" unit
      ['go_memstats_heap_inuse_bytes', 'Minimum and maximum', []],
      // counter / click on P95, P90 and P50 => P99 and P95 are selected
      ['prometheus_http_requests_total', 'Percentiles', ['P95', 'P90', 'P50']],
    ],
  },
  {
    category: 'histograms',
    namesAndPresets: [
      // native histogram / click on P99 => P90 and P50 are selected
      ['prometheus_http_request_duration_seconds', 'Percentiles', ['P99']],
      // non-native histogram / click on P99 and P50 => P90 is selected
      ['http_server_duration_milliseconds_bucket', 'Percentiles', ['P99', 'P50']],
    ],
  },
  {
    category: 'others',
    namesAndPresets: [
      // age
      ['grafana_alerting_ticker_last_consumed_tick_timestamp_seconds', 'Average age', []],
      // info
      ['pyroscope_build_info', 'Sum', []],
      // status up/down
      ['up', 'Stat with latest value', []],
    ],
  },
];

test.describe('Metrics reducer: panel types', () => {
  test.beforeEach(async ({ metricsReducerView }) => {
    await metricsReducerView.goto();
  });

  // eslint-disable-next-line playwright/expect-expect
  test('All panel types', async ({ metricsReducerView, expectScreenshotInCurrentGrafanaVersion }) => {
    const searchText = TEST_DATA.flatMap(({ namesAndPresets }) =>
      namesAndPresets.map(([metricName]) => `^${metricName}$`)
    ).join(',');
    await metricsReducerView.quickSearch.enterText(searchText);
    await metricsReducerView.assertMetricsList();

    await expectScreenshotInCurrentGrafanaVersion(
      metricsReducerView.getMetricsList(),
      'metric-list-with-all-types.png'
    );

    // same but let's block the metadata fetching
    await metricsReducerView.route('**/api/datasources/uid/*/resources/api/v1/metadata*', async (route) => {
      await route.fulfill({ json: { status: 'success', data: {} } });
    });

    await metricsReducerView.reload();
    await metricsReducerView.assertMetricsList();

    await expectScreenshotInCurrentGrafanaVersion(
      metricsReducerView.getMetricsList(),
      'metric-list-with-all-types.png'
    );
  });

  for (const { category, namesAndPresets } of TEST_DATA) {
    test(`Each metric type in its corresponding panel (${category})`, async ({
      metricsReducerView,
      metricSceneView,
      expectScreenshotInCurrentGrafanaVersion,
    }) => {
      const searchText = namesAndPresets.map(([metricName]) => `^${metricName}$`).join(',');
      await metricsReducerView.quickSearch.enterText(searchText);

      for (const [metricName, presetName, presetParams] of namesAndPresets) {
        await metricsReducerView.selectMetricPanel(metricName);

        await metricSceneView.assertMainViz(metricName);
        await expect(metricSceneView.getMainViz()).toHaveScreenshot(`metric-scene-main-viz-${metricName}.png`);

        await metricSceneView.clickPanelConfigureButton();
        await expect(metricSceneView.getConfigureSlider()).toHaveScreenshot(
          `metric-scene-configure-slider-${category}-${metricName}.png`
        );
        await metricSceneView.selectAndApplyConfigPreset(presetName, presetParams);

        await metricSceneView.goBack();
      }

      await metricsReducerView.assertMetricsList();

      await expectScreenshotInCurrentGrafanaVersion(
        metricsReducerView.getMetricsList(),
        `metric-list-after-configure-${category}.png`
      );
    });
  }
});
