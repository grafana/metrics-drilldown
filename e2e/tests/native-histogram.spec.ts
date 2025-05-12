import { DEFAULT_STATIC_URL_SEARCH_PARAMS } from '../config/constants';
import { expect, test } from '../fixtures';

test.describe('Native Histogram', () => {
  test.beforeEach(async ({ selectMetricView }) => {
    await selectMetricView.goto(DEFAULT_STATIC_URL_SEARCH_PARAMS);
  });

  test('From select metrics', async ({ selectMetricView }) => {
    const NATIVE_HISTOGRAM_LABEL = `grafana_database_all_migrations_duration_seconds`;

    await selectMetricView.quickSearch.enterText(NATIVE_HISTOGRAM_LABEL);
    await selectMetricView.assertPanel(NATIVE_HISTOGRAM_LABEL);

    const panelHeader = selectMetricView
      .getPanelByTitle(NATIVE_HISTOGRAM_LABEL)
      .getByTestId('data-testid header-container');

    await expect(panelHeader).toHaveScreenshot();
  });
});
