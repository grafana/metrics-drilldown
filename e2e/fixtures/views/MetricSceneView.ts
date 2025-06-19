import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL, ROUTES } from '../../../src/constants';
import { AppControls } from '../components/AppControls';
import { QuickSearchInput } from '../components/QuickSearchInput';

export class MetricSceneView extends DrilldownView {
  public appControls: AppControls;
  public quickSearch: QuickSearchInput;

  private static readonly ACTION_BAR_TABS = ['Breakdown', 'Related metrics', 'Related logs'] as const;

  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));

    this.appControls = new AppControls(page);
    this.quickSearch = new QuickSearchInput(page, 'Quick search related metrics');
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

    await expect(this.page.getByTestId('top-view').getByText(metricName)).toBeVisible();
    await expect(this.page.getByTestId('action-bar')).toBeVisible();

    await this.assertTabs();
  }

  /* Main vizualization */

  getMainViz() {
    return this.page.getByTestId('top-view').locator('[data-viz-panel-key]');
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
    const layoutName = await this.getLayoutSwitcher().locator('input[checked]~label').textContent();
    await expect(layoutName?.trim()).toBe(expectedLayoutName);
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
  }

  /* Breakdown tab */

  async assertBreadownListControls() {
    await this.assertLabelDropdown('All');
    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  getLabelDropdown() {
    return this.page.getByTestId('breakdown-label-selector');
  }

  async assertLabelDropdown(optionLabel: string) {
    await expect(this.getLabelDropdown().locator('input')).toHaveValue(optionLabel);
  }

  /* Related metrics tab */

  async assertRelatedMetricsListControls() {
    await this.assertPrefixFilterDropdown('All metric names');

    await expect(this.quickSearch.get()).toBeVisible();

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
