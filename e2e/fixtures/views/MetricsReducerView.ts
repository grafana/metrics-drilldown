import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL } from '../../../src/constants';
import { UI_TEXT } from '../../../src/constants/ui';
import { QuickSearch } from '../components/QuickSearchInput';

export type SortOption = 'Default' | 'Dashboard Usage' | 'Alerting Usage';

export class MetricsReducerView extends DrilldownView {
  public quickSearch: QuickSearch;

  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));

    this.quickSearch = new QuickSearch(page);
  }

  gotoVariant(variantPath: string, urlSearchParams = new URLSearchParams()) {
    super.setPathName(`${PLUGIN_BASE_URL}${variantPath}`);
    // the spread order is important to override the default params (e.g. overriding "from" and "to")
    return super.goto(new URLSearchParams([...urlSearchParams, ...this.urlParams]));
  }

  /* List controls */

  getListControls() {
    return this.getByTestId('list-controls');
  }

  async assertListControls() {
    const listControls = this.getListControls();

    await expect(listControls.getByText('Sort by')).toBeVisible();

    await expect(this.quickSearch.getInput()).toBeVisible();

    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
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

  async getSideBar() {
    return this.getByTestId('sidebar-buttons');
  }

  async toggleSideBarButton(buttonName: string) {
    const sidebar = await this.getSideBar();
    await sidebar.getByRole('button', { name: buttonName }).click();
  }

  async assertSidebar() {
    const sidebar = await this.getSideBar();

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

  /* Bookmarks */
  async createBookmark() {
    await this.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.BOOKMARK_LABEL).click();
  }

  async assertBookmarkAlert() {
    await expect(this.getByText('Bookmark created')).toBeVisible();
  }

  async assertBookmarkCreated(title: string) {
    await expect(this.getByRole('button', { name: title })).toBeVisible();
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

  async changeSortOption(sortBy: SortOption) {
    await this.page.getByTestId('list-controls').getByTestId('data-testid template variable').click();
    await this.page.getByRole('option', { name: sortBy }).locator('span').click();
  }
}
