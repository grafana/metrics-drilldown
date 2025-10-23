import { expect, test } from '../../fixtures';

type CategoryTest = {
  category: 'gauges and counters' | 'histograms' | 'others';
  nameLabelPresets: Array<{ metric: string; label: string; presetName: string; presetParams: string[] }>;
};

const TEST_DATA: CategoryTest[] = [
  {
    category: 'gauges and counters',
    nameLabelPresets: [
      // gauge with no unit
      { metric: 'go_goroutines', label: 'job', presetName: 'Standard deviation', presetParams: [] },
      // gauge with "bytes" unit
      { metric: 'go_memstats_heap_inuse_bytes', label: 'job', presetName: 'Minimum and maximum', presetParams: [] },
      // counter / click on P95, P90 and P50 => P99 and P95 are selected
      {
        metric: 'prometheus_http_requests_total',
        label: 'code',
        presetName: 'Percentiles',
        presetParams: ['P95', 'P90', 'P50'],
      },
    ],
  },
  {
    category: 'histograms',
    nameLabelPresets: [
      // native histogram / click on P99 => P90 and P50 are selected
      {
        metric: 'prometheus_http_request_duration_seconds',
        label: 'handler',
        presetName: 'Percentiles',
        presetParams: ['P99'],
      },
      // non-native histogram / click on P99 and P50 => P90 is selected
      {
        metric: 'go_gc_heap_allocs_by_size_bytes_bucket',
        label: 'job',
        presetName: 'Percentiles',
        presetParams: ['P99', 'P50'],
      },
    ],
  },
  {
    category: 'others',
    nameLabelPresets: [
      // age
      {
        metric: 'grafana_alerting_ticker_last_consumed_tick_timestamp_seconds',
        label: 'instance',
        presetName: 'Average age',
        presetParams: [],
      },
      // status up/down
      { metric: 'up', label: 'job', presetName: 'Stat with latest value', presetParams: [] },
    ],
  },
];

test.describe('Metrics reducer: panel types', () => {
  test.beforeEach(async ({ metricsReducerView }) => {
    await metricsReducerView.goto();
  });

  // eslint-disable-next-line playwright/expect-expect
  test('All panel types', async ({ metricsReducerView }) => {
    const searchText = TEST_DATA.flatMap(({ nameLabelPresets }) =>
      nameLabelPresets.map(({ metric }) => `^${metric}$`)
    ).join(',');
    await metricsReducerView.quickSearch.enterText(searchText);
    await metricsReducerView.assertMetricsList();

    // await expectScreenshotInCurrentGrafanaVersion(
    //   metricsReducerView.getMetricsList(),
    //   'metric-list-with-all-types.png'
    // );

    // same but let's block the metadata fetching
    await metricsReducerView.route('**/api/datasources/uid/*/resources/api/v1/metadata*', async (route) => {
      await route.fulfill({ json: { status: 'success', data: {} } });
    });

    await metricsReducerView.reload();
    await metricsReducerView.assertMetricsList();

    // Verify the metrics list is still displayed after blocking metadata
  });

  for (const { category, nameLabelPresets } of TEST_DATA) {
    test(`Each metric type in its corresponding panel (${category})`, async ({
      metricsReducerView,
      metricSceneView,
    }) => {
      const searchText = nameLabelPresets.map(({ metric }) => `^${metric}$`).join(',');
      await metricsReducerView.quickSearch.enterText(searchText);

      for (const { metric, label, presetName, presetParams } of nameLabelPresets) {
        // select panel
        await metricsReducerView.selectMetricPanel(metric);
        await metricSceneView.assertMainViz(metric);
        await expect(metricSceneView.getMainViz()).toBeVisible();

        await metricSceneView.selectLabel(label);
        await metricSceneView.assertBreadownListControls({ label, sortBy: 'Outlying series' });

        // open config slider and apply config
        await metricSceneView.clickPanelConfigureButton();
        await expect(metricSceneView.getConfigureSlider()).toBeVisible();
        await metricSceneView.selectAndApplyConfigPreset(presetName, presetParams);

        // wait for panels updates
        await metricSceneView.assertPanelsList();

        // got back to metrics reducer
        await metricSceneView.goBack(); // undo label selection
        await metricSceneView.goBack(); // back to metrics reducer
      }

      await metricsReducerView.assertMetricsList();
    });
  }
});
