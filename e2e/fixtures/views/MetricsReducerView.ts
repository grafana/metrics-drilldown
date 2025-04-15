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

  /* List controls */

  getListControls() {
    return this.getByTestId('list-controls');
  }

  async assertListControls() {
    const listControls = this.getListControls();

    await expect(listControls.getByText('Sort by')).toBeVisible();

    await expect(this.getQuickFilterInput()).toBeVisible();
    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
    return;
  }

  /* Quick filter */

  getQuickFilterInput() {
    return this.getListControls().getByPlaceholder('Search metrics');
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

  /* Side bar */

  async assertSidebar() {
    const sidebar = this.getByTestId('sidebar-buttons');

    for (const buttonName of [
      'Rules filters',
      'Prefix filters',
      'Suffix filters',
      'Group by labels',
      'Bookmarks',
      'Settings',
    ]) {
      await expect(sidebar.getByRole('button', { name: new RegExp(buttonName, 'i') })).toBeVisible();
    }
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

  getPanelByTitle(panelTitle: string) {
    return this.getByTestId(`data-testid Panel header ${panelTitle}`);
  }

  selectMetricPanel(panelTitle: string) {
    return this.getPanelByTitle(panelTitle)
      .getByRole('button', { name: /select/i })
      .click();
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

  async selectPrefixFilter(prefix: string) {
    await this.assertSidebar();
    const prefixFiltersSection = await this.page.getByTestId('metric-prefix-filters');

    // Start by searching for the prefix filter
    const searchInput = await prefixFiltersSection.getByPlaceholder('Search...');
    await searchInput.fill(prefix);

    // Then select the prefix filter
    const prefixes = await prefixFiltersSection.getByTestId('checkbox-filters-list').getByRole('listitem');
    const targetPrefix = await prefixes.filter({ hasText: prefix }).first();
    expect(targetPrefix).toBeVisible();
    await targetPrefix.getByTestId('checkbox').check({ force: true });
  }

  async selectMetric(metricName: string) {
    const element = await this.page.getByTestId(`select-action-${metricName}`);
    await element.scrollIntoViewIfNeeded();
    await element.click();
  }

  async selectMetricAndReturnToMetricsReducer(metricName: string) {
    await this.selectMetric(metricName);
    await this.page.goBack();
    await this.waitForMetricsUpdate();
  }

  async getVisibleMetrics(): Promise<string[]> {
    await this.waitForMetricsUpdate();
    const metricElements = await this.page.getByTestId('with-usage-data-preview-panel').all();
    await expect(async () => {
      const metricNames = await metricElements.map((el) =>
        el.getByTestId('header-container').getByRole('heading').textContent()
      );
      expect(metricNames.some((name) => name !== null)).toBe(true);
    }).toPass();
    return Promise.all(
      metricElements.map((el) => el.getByTestId('header-container').getByRole('heading').textContent())
    ) as Promise<string[]>;
  }

  async changeSortOption(sortBy: 'Default' | 'Dashboard Usage' | 'Alerting Usage') {
    await this.page.getByTestId('list-controls').getByTestId('data-testid template variable').click();
    await this.page.getByRole('option', { name: sortBy }).locator('span').click();
  }

  async waitForMetricsUpdate() {
    await this.page.waitForFunction(() => {
      const loadingIndicator = document.querySelector('[data-testid="metrics-loading"]');
      return !loadingIndicator;
    });

    await this.assertMetricsList();
  }

  async getMetricUsageCounts(usageType: 'dashboard' | 'alerting'): Promise<Record<string, number>> {
    await this.waitForMetricsUpdate();
    const usageCounts: Record<string, number> = {};

    // Get all metric items
    const metricItems = await this.page.getByTestId('with-usage-data-preview-panel').all();

    // For each metric item, extract its usage counts
    for (const item of metricItems) {
      const metricName = await item.locator(':is(h1, h2, h3, h4, h5, h6)').textContent();

      if (!metricName) {
        continue;
      }

      // Get the usage data panel for this metric
      const usagePanel = await item.locator('[data-testid="usage-data-panel"]');
      if (!usagePanel) {
        continue;
      }

      // Extract dashboard and alerting usage counts
      const usageCount = await usagePanel.locator(`[data-testid="${usageType}-usage"]`).textContent();

      // Store the total usage count
      usageCounts[metricName] = parseInt(usageCount || '0', 10);
    }

    return usageCounts;
  }

  async waitForMetricsWithUsage(usageType: 'dashboard' | 'alerting'): Promise<void> {
    // Wait for at least one metric with non-zero usage count to appear
    await expect(async () => {
      const panels = await this.page.getByTestId('with-usage-data-preview-panel').all();
      let panelsWithUsage = 0;
      for (const panel of panels) {
        const usageElement = panel.locator(`[data-testid="${usageType}-usage"]`);
        const usageCount = parseInt((await usageElement.textContent()) || '0', 10);

        if (usageCount > 0) {
          panelsWithUsage++;
        }
      }

      expect(panelsWithUsage).toBeGreaterThan(0);
    }).toPass();
  }
}
