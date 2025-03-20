import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL, ROUTES } from '../../../src/constants';

export class SelectMetricView extends DrilldownView {
  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, `${PLUGIN_BASE_URL}/${ROUTES.Trail}`, new URLSearchParams(defaultUrlSearchParams));
  }

  goto(urlSearchParams = new URLSearchParams()) {
    return super.goto(new URLSearchParams([...this.urlParams, ...new URLSearchParams(urlSearchParams)]));
  }

  async assertTopControls() {
    await expect(this.getDataSourceSelector()).toBeVisible();

    await expect(this.getAdHocFilters()).toBeVisible();

    await expect(this.getTimePickerButton()).toBeVisible();
    await expect(this.getRefreshPicker()).toBeVisible();

    await expect(this.getSettingsButton()).toBeVisible();
    await expect(this.getPluginInfoButton()).toBeVisible();
  }

  /* Data source */

  getDataSourceSelector() {
    return this.getByLabel('Data source');
  }

  async assertSelectedDataSource(expectedDataSource: string) {
    const name = await this.getDataSourceSelector().textContent();
    await expect(name?.trim()).toBe(expectedDataSource);
  }

  /* Ad Hoc filters */

  getAdHocFilters() {
    return this.getByPlaceholder('Filter by label values');
  }

  /* Time picker/refresh */

  getTimePickerButton() {
    return this.getByTestId('data-testid TimePicker Open Button');
  }

  async assertSelectedTimeRange(expectedTimeRange: string) {
    await expect(this.getTimePickerButton()).toContainText(expectedTimeRange);
  }

  async selectTimeRange(quickRangeLabel: string) {
    await this.getTimePickerButton().click();
    await this.getByTestId('data-testid TimePicker Overlay Content').getByText(quickRangeLabel).click();
  }

  getRefreshPicker() {
    return this.getByTestId('data-testid RefreshPicker run button');
  }

  clickOnRefresh() {
    return this.getRefreshPicker().click();
  }

  /* Settings/plugin info */

  getSettingsButton() {
    return this.getByTestId('settings-button');
  }

  getPluginInfoButton() {
    return this.getByTestId('plugin-info-button');
  }

  /* Quick filter */

  getQuickFilterInput() {
    return this.getByPlaceholder('Search metrics');
  }

  async assertQuickFilter(explectedPlaceholder: string, expectedValue: string, expectedResultsCount: number) {
    await expect(await this.getQuickFilterInput().getAttribute('placeholder')).toBe(explectedPlaceholder);
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

  /* Scene body */

  getSceneBody() {
    return this.getByTestId('scene-body');
  }

  getPanelByTitle(panelTitle: string) {
    return this.locator('[data-viz-panel-key]').getByTestId('header-container').getByTitle(panelTitle);
  }
}
