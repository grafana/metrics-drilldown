import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL } from '../../../src/shared/constants/plugin';
import { ROUTES } from '../../../src/shared/constants/routes';
import { UI_TEXT } from '../../../src/shared/constants/ui';
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
    // Wait for metrics list to re-render after sort
    await expect(this.getMetricsList().locator('[data-viz-panel-key]').first()).toBeVisible();
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

  /* Metrics list */

  getMetricsList() {
    return this.getByTestId('metrics-list');
  }

  async assertMetricsList() {
    const metricsList = this.getMetricsList();
    await expect(metricsList).toBeVisible();
    await expect(metricsList.locator('[data-viz-panel-key]').first()).toBeVisible();
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
    await expect(metricsList.locator('[data-viz-panel-key]').first()).toBeVisible();
  }

  async selectMetricsGroup(labelName: string, labelValue: string) {
    await this.getMetricsGroupByList()
      .getByTestId(`${labelName}-${labelValue}-metrics-group`)
      .getByRole('button', { name: 'Select' })
      .first()
      .click();
    // Wait for panels to re-render after group selection
    await expect(this.getMetricsList().locator('[data-viz-panel-key]').first()).toBeVisible();
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

  async clickPanelConfigureButton(panelTitle: string) {
    await this.getPanelByTitle(panelTitle).getByTestId('configure-panel').click();
  }
}
