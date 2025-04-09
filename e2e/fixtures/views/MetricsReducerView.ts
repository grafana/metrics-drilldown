import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL } from '../../../src/constants';

export class MetricsReducerView extends DrilldownView {
  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));
  }

  gotoVariant(variantPath: string, urlSearchParams = new URLSearchParams()) {
    super.setPathName(`${PLUGIN_BASE_URL}${variantPath}`);
    return super.goto(new URLSearchParams([...this.urlParams, ...new URLSearchParams(urlSearchParams)]));
  }

  /* Header controls */

  getHeaderControls() {
    return this.getByTestId('header-controls');
  }

  async assertHeaderControls(variant: 'filters' | 'pills' | 'labels') {
    const headerControls = this.getHeaderControls();

    if (variant === 'filters') {
      // pills should not be visible
      await expect(headerControls.getByRole('button', { name: 'Metric prefixes' })).not.toBeVisible();
      await expect(headerControls.getByRole('button', { name: 'Metric categories' })).not.toBeVisible();

      await expect(headerControls.getByText('Group by label')).toBeVisible();
      await expect(headerControls.getByText('Sort by')).toBeVisible();

      await expect(this.getQuickFilterInput()).toBeVisible();
      await expect(this.getLayoutSwitcher()).toBeVisible();
      await this.assertSelectedLayout('Grid');
      return;
    }

    if (variant === 'pills') {
      // pills should be visible
      await expect(headerControls.getByRole('button', { name: 'Metric prefixes' })).toBeVisible();
      await expect(headerControls.getByRole('button', { name: 'Metric categories' })).toBeVisible();

      await expect(headerControls.getByText('Group by label')).toBeVisible();
      await expect(headerControls.getByText('Sort by')).toBeVisible();

      await expect(this.getQuickFilterInput()).toBeVisible();
      await expect(this.getLayoutSwitcher()).toBeVisible();
      await this.assertSelectedLayout('Grid');
      return;
    }

    /* Labels */
    // pills should not be visible
    await expect(headerControls.getByRole('button', { name: 'Metric prefixes' })).not.toBeVisible();
    await expect(headerControls.getByRole('button', { name: 'Metric categories' })).not.toBeVisible();

    await expect(headerControls.getByText('Group by label')).not.toBeVisible();
    await expect(headerControls.getByText('Sort by')).toBeVisible();

    await expect(this.getQuickFilterInput()).toBeVisible();
    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  /* Quick filter */

  getQuickFilterInput() {
    return this.getHeaderControls().getByPlaceholder('Search metrics');
  }

  async assertQuickFilter(expectedValue: string, expectedResultsCount: number) {
    await expect(this.getQuickFilterInput()).toHaveValue(expectedValue);
    await this.assertQuickFilterResultsCount(expectedResultsCount);
  }

  async enterQuickFilterText(searchText: string) {
    await this.getQuickFilterInput().fill(searchText);
    await this.waitForTimeout(250); // see SceneQuickFilter.DEBOUNCE_DELAY
  }

  async assertQuickFilterResultsCount(expectedCount: number) {
    await expect(this.getByTestId('quick-filter-results-count')).toHaveText(String(expectedCount));
  }

  /* Layout switcher */

  getLayoutSwitcher() {
    return this.getByLabel('Layout switcher');
  }

  async assertSelectedLayout(expectedLayoutName: 'Grid' | 'Row') {
    const layoutName = await this.getLayoutSwitcher().locator('input[checked]~label').textContent();
    await expect(layoutName?.trim()).toBe(expectedLayoutName);
  }

  selectLayout(layoutName: string) {
    return this.getLayoutSwitcher().getByLabel(layoutName).click();
  }

  /* Side bars */

  async assertSidebar(variant: 'filters' | 'pills' | 'labels') {
    const sidebar = this.getByTestId('sidebar');

    if (variant === 'filters') {
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
      return;
    }

    if (variant === 'pills') {
      await expect(sidebar).not.toBeVisible();
      return;
    }

    /* Labels */

    // Metric prefix filters
    const metricPrefixFilters = sidebar.getByTestId('metric-prefix-filters');

    await expect(metricPrefixFilters.getByRole('heading', { name: /metric prefix filters/i, level: 5 })).toBeVisible();
    await expect(metricPrefixFilters.getByRole('switch', { name: /hide empty/i })).toBeChecked();

    await expect(metricPrefixFilters.getByText('0 selected')).toBeVisible();
    await expect(metricPrefixFilters.getByRole('button', { name: 'clear', exact: true })).toBeVisible();

    const prefixesListItemsCount = await metricPrefixFilters.getByTestId('checkbox-filters-list').locator('li').count();
    expect(prefixesListItemsCount).toBeGreaterThan(0);

    // Labels browser
    const labelsBrowser = sidebar.getByTestId('labels-browser');

    await expect(labelsBrowser.getByRole('heading', { name: /group by label/i, level: 5 })).toBeVisible();

    await expect(labelsBrowser.getByText('No selection')).toBeVisible();
    await expect(labelsBrowser.getByRole('button', { name: 'clear', exact: true })).toBeVisible();

    const labelsCount = await labelsBrowser.getByTestId('labels-list').locator('label').count();
    expect(labelsCount).toBeGreaterThan(0);
  }

  /* Metrics list */

  getMetricsList() {
    return this.getByTestId('metrics-list');
  }

  async assertMetricsList() {
    const metricsList = this.getMetricsList();

    await expect(metricsList).toBeVisible();

    // we have to wait... if not, the assertion below (on the count) will fail without waiting for elements to be in the DOM
    // AFAIK, Playwright does not have an API to wait for multiple elements to be visible
    await expect(metricsList.locator('[data-viz-panel-key]').first()).toBeVisible();

    const panelsCount = await metricsList.locator('[data-viz-panel-key]').count();
    expect(panelsCount).toBeGreaterThan(0);
  }

  getMetricsGroupByList() {
    return this.getByTestId('metrics-groupby-list');
  }

  async assertMetricsGroupByList() {
    const metricsList = this.getMetricsGroupByList();

    await expect(metricsList).toBeVisible();

    // we have to wait... if not, the assertion below (on the count) will fail without waiting for elements to be in the DOM
    // AFAIK, Playwright does not have an API to wait for multiple elements to be visible
    await expect(metricsList.locator('[data-viz-panel-key]').first()).toBeVisible();

    const panelsCount = await metricsList.locator('[data-viz-panel-key]').count();
    expect(panelsCount).toBeGreaterThan(0);
  }
}
