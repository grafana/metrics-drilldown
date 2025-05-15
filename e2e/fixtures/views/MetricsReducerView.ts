import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL, ROUTES } from '../../../src/constants';
import { UI_TEXT } from '../../../src/constants/ui';
import { QuickSearchInput } from '../components/QuickSearchInput';
import { Sidebar } from '../components/Sidebar';

export type SortByOptionNames = 'Default' | 'Dashboard Usage' | 'Alerting Usage';

export class MetricsReducerView extends DrilldownView {
  public quickSearch: QuickSearchInput;
  public sidebar: Sidebar;

  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));

    this.quickSearch = new QuickSearchInput(page);
    this.sidebar = new Sidebar(page);
  }

  /* Navigation */

  goto(urlSearchParams = new URLSearchParams()) {
    super.setPathName(`${PLUGIN_BASE_URL}/${ROUTES.Drilldown}`);

    // the spread order is important to override the default params (e.g. overriding "from" and "to")
    return super.goto(new URLSearchParams([...urlSearchParams, ...this.urlParams]));
  }

  goBack() {
    return this.page.goBack();
  }

  /* Core UI assertions */

  async assertCoreUI() {
    await this.assertAppControls();
    await this.assertListControls();
    await this.sidebar.assert();
    await this.assertMetricsList();
  }

  /* App controls */

  getAppControls() {
    return this.getByTestId('app-controls');
  }

  async assertAppControls() {
    await expect(this.getAppControls()).toBeVisible();

    // left
    await expect(this.getDataSourceDropdown()).toBeVisible();
    await expect(this.getAdHocFilters()).toBeVisible();

    // right
    await expect(this.getTimePickerButton()).toBeVisible();
    await expect(this.getRefreshPicker()).toBeVisible();
    await expect(this.getPluginInfoButton()).toBeVisible();
  }

  /* Data source */

  getDataSourceDropdown() {
    return this.getAppControls().getByText('Data source');
  }

  async assertSelectedDataSource(expectedDataSource: string) {
    const name = await this.getDataSourceDropdown().textContent();
    expect(name?.trim()).toBe(expectedDataSource);
  }

  /* Ad Hoc filters */

  getAdHocFilters() {
    return this.getAppControls().getByPlaceholder('Filter by label values');
  }

  async setAdHocFilter(label: string, operator: string, value: string) {
    await this.getAdHocFilters().click();

    for (const text of [label, operator, value]) {
      await this.page.keyboard.type(text);
      await this.page.keyboard.press('Enter');
    }
  }

  async assertAdHocFilters(expectedFilters: string[]) {
    const appControls = this.getByTestId('app-controls');

    for (const expectedFilter of expectedFilters) {
      await expect(appControls.getByText(expectedFilter)).toBeVisible();
    }
  }

  /* Time picker/refresh */

  getTimePickerButton() {
    return this.getAppControls().getByTestId('data-testid TimePicker Open Button');
  }

  async assertSelectedTimeRange(expectedTimeRange: string) {
    await expect(this.getTimePickerButton()).toContainText(expectedTimeRange);
  }

  async selectTimeRange(quickRangeLabel: string) {
    await this.getTimePickerButton().click();
    await this.getByTestId('data-testid TimePicker Overlay Content').getByText(quickRangeLabel).click();
  }

  getRefreshPicker() {
    return this.getAppControls().getByTestId('data-testid RefreshPicker run button');
  }

  clickOnRefresh() {
    return this.getRefreshPicker().click();
  }

  /* Settings/plugin info */

  getSettingsButton() {
    return this.getAppControls().getByTestId('settings-button');
  }

  getPluginInfoButton() {
    return this.getAppControls().getByTestId('plugin-info-button');
  }

  /* List controls */

  getListControls() {
    return this.getByTestId('list-controls');
  }

  async assertListControls() {
    await expect(this.getListControls()).toBeVisible();
    await expect(this.quickSearch.getInput()).toBeVisible();
    await expect(this.getSortByDropdown()).toBeVisible();
    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  /* Sort by */

  getSortByDropdown() {
    return this.getListControls().getByTestId('sort-by-select');
  }

  async assertSelectedSortBy(expectedOptionName: SortByOption) {
    await expect(this.getSortByDropdown().getByText(expectedOptionName)).toBeVisible();
  }

  async selectSortByOption(expectedOptionName: SortByOption) {
    await this.getSortByDropdown().locator('input').click();
    await this.page.getByRole('option', { name: expectedOptionName }).locator('span').click();
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

  /* Panels */

  getPanelByTitle(panelTitle: string) {
    return this.getByTestId(`data-testid Panel header ${panelTitle}`);
  }

  async assertPanel(panelTitle: string) {
    await expect(this.getPanelByTitle(panelTitle)).toBeVisible();
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

  // TODO: If it's used once, don't declare it here, just use it in a single test
  async openPanelInExplore() {
    const explorePromise = this.page.waitForEvent('popup');
    await this.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OPEN_EXPLORE_LABEL).click();
    const explorePage = await explorePromise;
    return explorePage;
  }

  // TODO: If it's used once, don't declare it here, just use it in a single test
  async clickCopyPanelUrl() {
    await this.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.COPY_URL_LABEL).click();
  }
}
