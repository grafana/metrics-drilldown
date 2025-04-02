import { expect, test } from '../e2e/fixtures';

test.describe('Onboarding reducer view', () => {
  test.describe('Variant #1: Side bar with prefixes and categories filters', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant(
        '/onboard-filters-sidebar',
        new URLSearchParams({ 'var-variant': 'onboard-filters-sidebar' })
      );
    });

    test('Core UI elements and navigation to the metrics reducer view', async ({ metricsReducerView }) => {
      await expect(metricsReducerView.getQuickFilterInput()).toBeVisible();
      await expect(metricsReducerView.getLayoutSwitcher()).toBeVisible();

      await metricsReducerView.assertMetricsList();

      await metricsReducerView.getByTestId('top-controls').getByRole('button').nth(1).click();
      await metricsReducerView.assertMetricsGroupByList();

      // go to the metrics reducer view
      await metricsReducerView
        .getByRole('button', { name: /show all metrics/i })
        .first()
        .click();

      await metricsReducerView.assertHeaderControls('filters');
      await metricsReducerView.assertSidebar('filters');
      await metricsReducerView.assertMetricsList();
    });
  });

  test.describe('Variant #2: Pills with prefixes and categories filters', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant('/onboard-filters-pills');
    });

    test('Core UI elements and navigation to the metrics reducer view', async ({ metricsReducerView }) => {
      await expect(metricsReducerView.getQuickFilterInput()).toBeVisible();
      await expect(metricsReducerView.getLayoutSwitcher()).toBeVisible();

      await metricsReducerView.assertMetricsList();

      await metricsReducerView.getByTestId('top-controls').getByRole('button').first().click();
      await metricsReducerView.assertMetricsGroupByList();

      // go to the metrics reducer view
      await metricsReducerView
        .getByRole('button', { name: /show all metrics/i })
        .first()
        .click();

      await metricsReducerView.assertHeaderControls('pills');
      await metricsReducerView.assertSidebar('pills');
      await metricsReducerView.assertMetricsList();
    });
  });

  test.describe('Variant #3: Side bar with prefixes filters and group by labels', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant('/onboard-filters-labels');
    });

    test('Core UI elements and navigation to the metrics reducer view', async ({ metricsReducerView }) => {
      await expect(metricsReducerView.getQuickFilterInput()).toBeVisible();
      await expect(metricsReducerView.getLayoutSwitcher()).toBeVisible();

      await metricsReducerView.assertMetricsList();

      await metricsReducerView.getByTestId('top-controls').getByRole('button').first().click();
      await metricsReducerView.assertMetricsGroupByList();

      // go to the metrics reducer view
      await metricsReducerView
        .getByRole('button', { name: /show all metrics/i })
        .first()
        .click();

      await metricsReducerView.assertHeaderControls('labels');
      await metricsReducerView.assertSidebar('labels');
      await metricsReducerView.assertMetricsList();
    });
  });
});
