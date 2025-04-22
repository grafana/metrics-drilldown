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
  async setAdHocFilter(label: string, operator: string, value: string) {
    await this.getAdHocFilters().click();
    await this.page.keyboard.type(label);
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.type(operator);
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.type(value);
    await this.page.keyboard.press('Enter');
  }

  async assertAdHocFilters(expectedFilters: string[]) {
    const appControls = this.getByTestId('app-controls');

    for (const expectedFilter of expectedFilters) {
      await expect(appControls.getByText(expectedFilter)).toBeVisible();
    }
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

  getOtelExperienceSwitch() {
    return this.page.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OTEL_LABEL, { exact: true });
  }

  async assertOtelExperienceSwitchIsVisible() {
    await expect(this.getOtelExperienceSwitch()).toBeVisible();
  }

  async toggleOtelExperience(switchOn: boolean) {
    const otelSwitch = this.getOtelExperienceSwitch();

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

  async assertPanel(panelTitle: string) {
    await expect(this.getPanelByTitle(panelTitle)).toBeVisible();
  }

  async assertPanelIsNativeHistogram(panelTitle: string) {
    const panel = this.getPanelByTitle(panelTitle);
    await expect(panel.getByTestId('header-container').getByText('Native Histogram')).toBeVisible();
  }

  selectMetricPanel(panelTitle: string) {
    return this.getPanelByTitle(panelTitle)
      .getByRole('button', { name: /select/i })
      .click();
  }

  async openPanelInExplore() {
    const explorePromise = this.page.waitForEvent('popup');
    await this.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OPEN_EXPLORE_LABEL).click();
    const explorePage = await explorePromise;
    return explorePage;
  }

  /* Bookmarks */

  async clickCopyPanelUrl() {
    await this.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.COPY_URL_LABEL).click();
  }

  async createBookmark() {
    await this.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.BOOKMARK_LABEL).click();
  }

  async assertBookmarkAlert() {
    await expect(this.getByText('Bookmark created')).toBeVisible();
  }

  async seeAllBookmarksFromAlert() {
    await this.getByRole('link', { name: 'View bookmarks' }).click();
    await this.getByLabel('bookmarkCarrot').click();
  }

  async assertBookmarkCreated(title: string) {
    await expect(this.getByTestId('hp-bookmarks').getByText(title)).toBeVisible();
  }

  async selectNewMetric() {
    await this.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.SELECT_NEW_METRIC_TOOLTIP).click();
  }

  /* Native Histogram */
  async assertNativeHistogramBanner() {
    const alert = this.getByTestId('data-testid Alert info');
    await expect(alert).toBeVisible();
    await expect(alert.getByText('Native Histogram Support')).toBeVisible();
  }

  async assertNativeHistogramBannerIsNotVisible() {
    const alert = this.getByTestId('data-testid Alert info');
    await expect(alert).not.toBeVisible();
  }

  async expandNativeHistogramBanner() {
    await this.getByRole('button', { name: '> See examples' }).click();
  }

  async selectNativeHistogramExample(name: string) {
    await this.getByRole('button', { name }).click();
  }

  async assertHeatmapLabel(panelTitle: string) {
    await expect(this.getPanelByTitle(panelTitle).getByLabel('heatmap')).toBeVisible();
  }
}
