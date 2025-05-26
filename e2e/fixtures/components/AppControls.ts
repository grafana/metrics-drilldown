import { expect, type Keyboard, type Locator, type Page } from '@playwright/test';

export class AppControls {
  private readonly locator: Locator;
  private readonly keyboard: Keyboard;

  constructor(private readonly page: Page) {
    this.locator = page.getByTestId('app-controls');
    this.keyboard = page.keyboard;
  }

  get() {
    return this.locator;
  }

  async assert(assertSettings = false) {
    await expect(this.get()).toBeVisible();

    // left
    await expect(this.getDataSourceDropdown()).toBeVisible();
    await expect(this.getAdHocFilters()).toBeVisible();

    // right
    await expect(this.getTimePickerButton()).toBeVisible();

    if (assertSettings) {
      await expect(this.getSettingsButton()).toBeVisible();
    }

    await expect(this.getRefreshPicker()).toBeVisible();
    await expect(this.getPluginInfoButton()).toBeVisible();
  }

  /* Data source */

  getDataSourceDropdown() {
    return this.get().getByText('Data source');
  }

  async assertSelectedDataSource(expectedDataSource: string) {
    const name = await this.getDataSourceDropdown().textContent();
    expect(name?.trim()).toBe(expectedDataSource);
  }

  /* Ad Hoc filters */

  getAdHocFilters() {
    return this.get().getByPlaceholder('Filter by label values');
  }

  async setAdHocFilter(label: string, operator: string, value: string) {
    await this.getAdHocFilters().click();

    for (const text of [label, operator, value]) {
      await this.keyboard.type(text);
      await this.keyboard.press('Enter');
    }
  }

  async assertAdHocFilters(expectedFilters: string[]) {
    const appControls = this.page.getByTestId('app-controls');

    for (const expectedFilter of expectedFilters) {
      await expect(appControls.getByText(expectedFilter)).toBeVisible();
    }
  }

  /* Time picker/refresh */

  getTimePickerButton() {
    return this.get().getByTestId('data-testid TimePicker Open Button');
  }

  async assertSelectedTimeRange(expectedTimeRange: string) {
    await expect(this.getTimePickerButton()).toContainText(expectedTimeRange);
  }

  async selectTimeRange(quickRangeLabel: string) {
    await this.getTimePickerButton().click();
    await this.page.getByTestId('data-testid TimePicker Overlay Content').getByText(quickRangeLabel).click();
  }

  getRefreshPicker() {
    return this.get().getByTestId('data-testid RefreshPicker run button');
  }

  clickOnRefresh() {
    return this.getRefreshPicker().click();
  }

  /* Settings/plugin info */

  getSettingsButton() {
    return this.get().getByTestId('settings-button');
  }

  getPluginInfoButton() {
    return this.get().getByTestId('plugin-info-button');
  }
}
