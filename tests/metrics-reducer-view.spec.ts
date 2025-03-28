import { expect, test } from '../e2e/fixtures';

test.describe('Metrics reducer view', () => {
  test.describe('Variant #1: Side bar with prefixes and categories filters', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant(
        '/trail-filters-sidebar',
        new URLSearchParams({ 'var-variant': 'onboard-filters-sidebar' })
      );
    });

    test.describe('Header controls', () => {
      test('Core UI elements', async ({ metricsReducerView }) => {
        await expect(metricsReducerView.getQuickFilterInput()).toBeVisible();
        await expect(metricsReducerView.getByText('Group by label')).toBeVisible();
        await expect(metricsReducerView.getByText('Sort by')).toBeVisible();
        await expect(metricsReducerView.getLayoutSwitcher()).toBeVisible();
        await metricsReducerView.assertSelectedLayout('Grid');
      });
    });

    test.describe('Side bar', () => {
      test('Core UI elements', async ({ metricsReducerView }) => {
        const sidebar = metricsReducerView.getByTestId('sidebar');

        // Metric prefix filters
        const metricPrefixFilters = sidebar.getByTestId('metric-prefix-filters');

        await expect(
          metricPrefixFilters.getByRole('heading', { name: /metric prefix filters/i, level: 5 })
        ).toBeVisible();
        await expect(metricPrefixFilters.getByRole('switch', { name: /hide empty/i })).toBeChecked();

        await expect(metricPrefixFilters.getByText('0 selected')).toBeVisible();
        await expect(metricPrefixFilters.getByRole('button', { name: 'clear', exact: true })).toBeVisible();

        const prefixesListItemsCount = await metricPrefixFilters
          .getByTestId('checkbox-filters-list')
          .locator('li')
          .count();
        expect(prefixesListItemsCount).toBeGreaterThan(0);

        // Categories filters
        const categoriesFilters = sidebar.getByTestId('categories-filters');

        await expect(categoriesFilters.getByRole('heading', { name: /categories filters/i, level: 5 })).toBeVisible();
        await expect(categoriesFilters.getByRole('switch', { name: /hide empty/i })).toBeChecked();

        await expect(categoriesFilters.getByText('0 selected')).toBeVisible();
        await expect(categoriesFilters.getByRole('button', { name: 'clear', exact: true })).toBeVisible();

        const categoriesListItemsCount = await categoriesFilters
          .getByTestId('checkbox-filters-list')
          .locator('li')
          .count();
        expect(categoriesListItemsCount).toBeGreaterThan(0);
      });
    });

    test.describe('Metrics list', () => {
      test('Core UI elements', async ({ metricsReducerView }) => {
        const metricsList = metricsReducerView.getMetricsList();

        await expect(metricsList).toBeVisible();

        // we have to wait for at least the first element
        // if not, the assertion below (on the count) will fail without waiting for elements to be in the DOM
        // AFAIK, Playwright does not have an API to wait for a count of elements to be visible
        await expect(metricsList.locator('[data-viz-panel-key]').first()).toBeVisible();

        const panelsCount = await metricsList.locator('[data-viz-panel-key]').count();
        expect(panelsCount).toBeGreaterThan(0);
      });
    });
  });

  test.describe('Variant #2: Pills with prefixes and categories filters', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant('/trail-filters-pills');
    });
  });

  test.describe('Variant #3: Side bar with prefixes filters and group by labels', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant('/trail-filters-labels');
    });
  });
});
