import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL, ROUTES } from '../../../src/constants';

export class MetricSceneView extends DrilldownView {
  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));
  }

  /* Navigation */

  goto(urlSearchParams = new URLSearchParams()) {
    super.setPathName(`${PLUGIN_BASE_URL}/${ROUTES.Drilldown}`);

    // the spread order is important to override the default params (e.g. overriding "from" and "to")
    return super.goto(new URLSearchParams([...urlSearchParams, ...this.urlParams]));
  }

  /* Core UI assertions */

  async assertCoreUI() {
    await this.assertAppControls();
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
    await expect(this.getSettingsButton()).toBeVisible();
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
}
