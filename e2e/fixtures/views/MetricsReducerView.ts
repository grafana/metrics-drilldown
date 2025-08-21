import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL, ROUTES } from '../../../src/constants';
import { UI_TEXT } from '../../../src/constants/ui';
import { AppControls } from '../components/AppControls';
import { QuickSearchInput } from '../components/QuickSearchInput';
import { Sidebar } from '../components/Sidebar';

export type SortByOptionNames = 'Default' | 'Dashboard Usage' | 'Alerting Usage';

export class MetricsReducerView extends DrilldownView {
  public appControls: AppControls;
  public quickSearch: QuickSearchInput;
  public sidebar: Sidebar;

  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));

    this.appControls = new AppControls(page);
    this.quickSearch = new QuickSearchInput(page, 'Quick search metrics');
    this.sidebar = new Sidebar(page);
  }

  /* Navigation */

  goto(urlSearchParams = new URLSearchParams()) {
    super.setPathName(`${PLUGIN_BASE_URL}/${ROUTES.Drilldown}`);

    // the spread order is important to override the default params (e.g. overriding "from" and "to")
    return super.goto(new URLSearchParams([...urlSearchParams, ...this.urlParams]));
  }

  /* Core UI assertions */

  async assertCoreUI() {
    await this.appControls.assert();
    await this.sidebar.assert();
    await this.assertListControls();
    await this.assertMetricsList();
  }

  /* Ad Hoc filters */

  async assertAdHocFilter(labelName: string, operator: string, labelValue: string) {
    const filter = this.getByRole('button', { name: `Edit filter with key ${labelName}` });
    await expect(filter).toBeVisible();
    await expect(filter).toHaveText(`${labelName} ${operator} ${labelValue}`);
  }

  async clearAdHocFilter(labelName: string) {
    await this.getByRole('button', { name: `Remove filter with key ${labelName}` }).click();
    await this.getByTestId('metrics-drilldown-app').click(); // prevents the dropdown to appear
  }

  async setAdHocFilter(labelName: string, operator: string, labelValue: string) {
    await this.getByRole('combobox', { name: 'Filter by label values' }).click();
    await this.getByRole('option', { name: labelName }).click();
    await this.page.keyboard.type(operator);
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.type(labelValue);
    await this.page.keyboard.press('Enter');
  }

  /* List controls */

  getListControls() {
    return this.getByTestId('list-controls');
  }

  async assertListControls() {
    await expect(this.getListControls()).toBeVisible();
    await expect(this.quickSearch.get()).toBeVisible();
    await expect(this.getSortByDropdown()).toBeVisible();
    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  /* Sort by */

  getSortByDropdown() {
    return this.getListControls().getByTestId('sort-by-select');
  }

  async assertSelectedSortBy(expectedOptionName: SortByOptionNames) {
    await expect(this.getSortByDropdown().getByText(expectedOptionName)).toBeVisible();
  }

  async selectSortByOption(optionName: SortByOptionNames) {
    await this.getSortByDropdown().locator('input').click();
    await this.getByRole('option', { name: optionName }).locator('span').click();
  }

  /* Layout switcher */

  getLayoutSwitcher() {
    return this.getByLabel('Layout switcher');
  }

  async assertSelectedLayout(expectedLayoutName: 'Grid' | 'Row') {
    const layoutName = await this.getLayoutSwitcher().locator('input[checked]~label').textContent();
    expect(layoutName?.trim()).toBe(expectedLayoutName);
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

    const panelsLocator = metricsList.locator('[data-viz-panel-key]');

    // we have to wait... if not, the assertion on the count of panels below will fail without waiting for elements to be in the DOM
    // AFAIK, Playwright does not have an API to wait for multiple elements to be visible
    await this.waitForTimeout(500); // Wait for some extra time to prevent flakiness
    await expect(panelsLocator.first()).toBeVisible();

    expect(await panelsLocator.count()).toBeGreaterThan(0);

    // TODO: find a better way
    await this.waitForTimeout(2000); // Wait for some extra time for the panels to show data and the UI to stabilize (y-axis sync, ...)
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

    // TODO: find a better way
    await this.waitForTimeout(2500); // Wait for some extra time for the panels to show data and the UI to stabilize (y-axis sync, ...)
  }

  async selectMetricsGroup(labelName: string, labelValue: string) {
    await this.getMetricsGroupByList()
      .getByTestId(`${labelName}-${labelValue}-metrics-group`)
      .getByRole('button', { name: 'Select' })
      .first()
      .click();
  }

  async openPanelInExplore() {
    const explorePromise = this.page.waitForEvent('popup');
    await this.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OPEN_EXPLORE_LABEL).click();
    const explorePage = await explorePromise;
    return explorePage;
  }

  async clickCopyPanelUrl() {
    await this.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.COPY_URL_LABEL).click();
  }

  async clickConfigurePanelButton(panelTitle: string) {
    await this.getPanelByTitle(panelTitle).getByTestId('configure-panel').click();
  }
}
