import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL, ROUTES } from '../../../src/constants';
import { UI_TEXT } from '../../../src/constants/ui';

export class SelectMetricView extends DrilldownView {
  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, `${PLUGIN_BASE_URL}/${ROUTES.Trail}`, new URLSearchParams(defaultUrlSearchParams));
  }

  goto(urlSearchParams = new URLSearchParams()) {
    // the spread order is important to override the default params (e.g. overriding "from" and "to")
    return super.goto(new URLSearchParams([...urlSearchParams, ...this.urlParams]));
  }

  getControls() {
    return this.getByTestId('app-controls');
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
    return this.getControls().getByText('Data source');
  }

  async assertSelectedDataSource(expectedDataSource: string) {
    const name = await this.getDataSourceSelector().textContent();
    expect(name?.trim()).toBe(expectedDataSource);
  }

  selectExplorationType(dataSource: string) {
    return this.getDataSourceSelector().getByLabel(dataSource).click();
  }

  /* Ad Hoc filters */

  getAdHocFilters() {
    return this.getControls().getByPlaceholder('Filter by label values');
  }

  // TODO: This can probably be better by having getByGrafanaSelector
  // https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/selecting-elements#select-field
  async setAdHocFilter(label: string, value: string) {
    await this.getAdHocFilters().click();
    await this.page.keyboard.type(label);
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.type('=');
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.type(value);
    await this.page.keyboard.press('Enter');
  }

  /* Time picker/refresh */

  getTimePickerButton() {
    return this.getControls().getByTestId('data-testid TimePicker Open Button');
  }

  async assertSelectedTimeRange(expectedTimeRange: string) {
    await expect(this.getTimePickerButton()).toContainText(expectedTimeRange);
  }

  async selectTimeRange(quickRangeLabel: string) {
    await this.getTimePickerButton().click();
    await this.getByTestId('data-testid TimePicker Overlay Content').getByText(quickRangeLabel).click();
  }

  getRefreshPicker() {
    return this.getControls().getByTestId('data-testid RefreshPicker run button');
  }

  clickOnRefresh() {
    return this.getRefreshPicker().click();
  }

  /* Settings/plugin info */

  getSettingsButton() {
    return this.getControls().getByTestId('settings-button');
  }

  getPluginInfoButton() {
    return this.getControls().getByTestId('plugin-info-button');
  }

  /* Quick filter */

  getQuickFilterInput() {
    return this.getByPlaceholder('Search metrics');
  }

  async assertQuickFilter(explectedPlaceholder: string, expectedValue: string, expectedResultsCount: number) {
    expect(await this.getQuickFilterInput().getAttribute('placeholder')).toBe(explectedPlaceholder);
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

  /* Otel */

  async toggleOtelExperience(switchOn: boolean) {
    const otelSwitch = this.page.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OTEL_LABEL);

    if (switchOn) {
      await expect(otelSwitch).not.toBeChecked();
      await otelSwitch.check();
    } else {
      await expect(otelSwitch).toBeChecked();
      await otelSwitch.uncheck();
    }
  }

  /* Scene body */

  getSceneBody() {
    return this.getByTestId('scene-body');
  }

  /* Viz panels */

  getPanelByTitle(panelTitle: string) {
    return this.getByTestId(`data-testid Panel header ${panelTitle}`);
  }

  selectMetricPanel(panelTitle: string) {
    return this.getPanelByTitle(panelTitle)
      .getByRole('button', { name: /select/i })
      .click();
  }
}
