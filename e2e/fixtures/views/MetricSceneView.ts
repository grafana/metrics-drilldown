import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL, ROUTES } from '../../../src/constants';
import { AppControls } from '../components/AppControls';
import { QuickSearchInput } from '../components/QuickSearchInput';

export type SortByOptionNames = 'Outlying series' | 'Name [A-Z]' | 'Name [Z-A]';

export class MetricSceneView extends DrilldownView {
  public appControls: AppControls;
  public quickSearchLabelValues: QuickSearchInput;
  public quickSearchRelatedMetrics: QuickSearchInput;

  private static readonly ACTION_BAR_TABS = ['Breakdown', 'Related metrics', 'Related logs'] as const;

  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));

    this.appControls = new AppControls(page);
    this.quickSearchLabelValues = new QuickSearchInput(page, 'Quick search label values');
    this.quickSearchRelatedMetrics = new QuickSearchInput(page, 'Quick search related metrics');
  }

  /* Navigation */

  goto(urlSearchParams = new URLSearchParams()) {
    super.setPathName(`${PLUGIN_BASE_URL}/${ROUTES.Drilldown}`);

    if (!urlSearchParams.has('metric')) {
      throw new Error('goto Error: No metric specified in the URL search parameters!');
    }

    // the spread order is important to override the default params (e.g. overriding "from" and "to")
    return super.goto(new URLSearchParams([...urlSearchParams, ...this.urlParams]));
  }

  /* Core UI assertions */

  async assertCoreUI(metricName: string) {
    await this.appControls.assert(true);

    await this.assertMainViz(metricName);
    await expect(this.page.getByTestId('action-bar')).toBeVisible();

    await this.assertTabs();
  }

  /* Main vizualization */

  getMainViz() {
    return this.page.getByTestId('top-view').locator('[data-viz-panel-key]');
  }

  async assertMainViz(metricName: string) {
    await expect(this.page.getByTestId('top-view').getByText(metricName)).toBeVisible();

    // we wait for some time to make sure that data is rendered
    // TODO: how to improve this and not rely on an arbitrary timeout?
    await this.waitForTimeout(500);
  }

  /* Tabs */

  getTabsList() {
    return this.page.getByRole('tablist');
  }

  async assertTabs() {
    const tabsList = this.getTabsList();

    for (const tabLabel of MetricSceneView.ACTION_BAR_TABS) {
      await expect(tabsList.getByRole('tab', { name: tabLabel })).toBeVisible();
    }

    await expect(tabsList.getByRole('tab', { name: 'Breakdown', selected: true })).toBeVisible();
  }

  async selectTab(tabLabel: 'Breakdown' | 'Related metrics' | 'Related logs') {
    await this.getTabsList().getByRole('tab', { name: tabLabel }).click();
  }

  getTabContent() {
    return this.page.getByTestId('tab-content');
  }

  /* Layout switcher */

  getLayoutSwitcher() {
    return this.getByLabel('Layout switcher');
  }

  async assertSelectedLayout(expectedLayoutName: 'Grid' | 'Row') {
    await expect(this.getLayoutSwitcher().locator('input[checked]~label')).toContainText(expectedLayoutName);
  }

  selectLayout(layoutName: string) {
    return this.getLayoutSwitcher().getByLabel(layoutName).click();
  }

  /* Panels list */

  getPanelsList() {
    return this.getByTestId('panels-list');
  }

  async assertPanelsList() {
    const panelsList = this.getPanelsList();
    await expect(panelsList).toBeVisible();

    // we have to wait... if not, the assertion below (on the count) will fail without waiting for elements to be in the DOM
    // AFAIK, Playwright does not have an API to wait for multiple elements to be visible
    await expect(panelsList.locator('[data-viz-panel-key]').first()).toBeVisible();

    const panelsCount = await panelsList.locator('[data-viz-panel-key]').count();
    expect(panelsCount).toBeGreaterThan(0);

    // TODO: find a better way
    await this.waitForTimeout(2500); // Wait for some extra time for the panels to show data and the UI to stabilize (y-axis sync, ...)
  }

  /* Breakdown tab */

  getSingleBreakdownPanel() {
    return this.page.getByTestId('single-metric-panel');
  }

  async assertDefaultBreadownListControls() {
    await this.assertLabelDropdown('All');
    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  getLabelDropdown() {
    return this.page.getByTestId('breakdown-label-selector');
  }

  async assertLabelDropdown(optionLabel: string) {
    await expect(this.getLabelDropdown().getByText(optionLabel).first()).toBeVisible();
  }

  async selectLabel(label: string) {
    await this.getLabelDropdown().locator('input').click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async assertBreadownListControls({ label, sortBy }: { label: string; sortBy: string }) {
    await this.assertLabelDropdown(label);
    await expect(this.quickSearchLabelValues.get()).toBeVisible();
    await expect(this.getSortByDropdown()).toBeVisible();
    await this.assertSelectedSortBy(sortBy);
    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  getSortByDropdown() {
    return this.page.getByTestId('sort-by-select');
  }

  async assertSelectedSortBy(expectedSortBy: string) {
    await expect(this.getSortByDropdown().locator('input')).toHaveValue(expectedSortBy);
  }

  async selectSortByOption(optionName: SortByOptionNames) {
    await this.getSortByDropdown().locator('input').click();
    await this.page.getByRole('option', { name: optionName }).getByText(optionName).click();
  }

  /* Related metrics tab */

  async assertRelatedMetricsListControls() {
    await this.assertPrefixFilterDropdown('All metric names');

    await expect(this.quickSearchRelatedMetrics.get()).toBeVisible();

    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  getPrefixFilterDropdown() {
    return this.page.getByTestId('prefix-filter-selector');
  }

  async assertPrefixFilterDropdown(optionLabel: string) {
    await expect(this.getPrefixFilterDropdown().locator('input')).toHaveValue(optionLabel);
  }

  async selectPrefixFilterOption(expectedOptionName: string) {
    await this.getPrefixFilterDropdown().locator('input').click();
    await this.page.getByRole('option', { name: expectedOptionName }).click();
  }
}
