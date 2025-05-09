import { test } from '../fixtures';

const NATIVE_HISTOGRAM_LABEL = `grafana_database_all_migrations_duration_seconds`;

test.describe('Native Histogram', () => {
  test.beforeEach(async ({ selectMetricView }) => {
    await selectMetricView.goto();
  });

  test('From select metrics', async ({ selectMetricView }) => {
    await selectMetricView.quickSearch.enterText(NATIVE_HISTOGRAM_LABEL);
    await selectMetricView.assertPanel(NATIVE_HISTOGRAM_LABEL);
    await selectMetricView.assertPanelIsNativeHistogram(NATIVE_HISTOGRAM_LABEL);
  });
});
