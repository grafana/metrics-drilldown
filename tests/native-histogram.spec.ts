import { test } from '../e2e/fixtures';

const NATIVE_HISTOGRAM_LABEL = `grafana_database_all_migrations_duration_seconds`;

test.describe('Native Histogram', () => {
  test.beforeEach(async ({ selectMetricView }) => {
    await selectMetricView.goto();
  });

  test('Banner Flow', async ({ selectMetricView }) => {
    await selectMetricView.assertNativeHistogramBanner();
    await selectMetricView.expandNativeHistogramBanner();
    await selectMetricView.selectNativeHistogramExample(NATIVE_HISTOGRAM_LABEL);
    await selectMetricView.assertPanel(NATIVE_HISTOGRAM_LABEL);
    await selectMetricView.assertHeatmapLabel(NATIVE_HISTOGRAM_LABEL);
    await selectMetricView.selectNewMetric();
    await selectMetricView.assertNativeHistogramBannerIsNotVisible();
  });

  test('From select metrics', async ({ selectMetricView }) => {
    await selectMetricView.enterQuickFilterText(NATIVE_HISTOGRAM_LABEL);
    await selectMetricView.assertPanel(NATIVE_HISTOGRAM_LABEL);
    await selectMetricView.assertPanelIsNativeHistogram(NATIVE_HISTOGRAM_LABEL);
  });
});
