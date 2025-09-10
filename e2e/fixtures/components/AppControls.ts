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
    await expect(this.getAdHocFiltersInput()).toBeVisible();

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

  getAdHocFiltersInput() {
    return this.get().getByRole('combobox', { name: 'Filter by label values' });
  }

  async addAdHocFilter(labelName: string, operator: string, labelValue: string) {
    await this.getAdHocFiltersInput().click();

    await this.page.getByRole('option', { name: labelName }).click();

    await this.keyboard.type(operator);
    await this.keyboard.press('Enter');

    await this.keyboard.type(labelValue);
    await this.keyboard.press('Enter');
  }

  async assertAdHocFilter(labelName: string, operator: string, labelValue: string) {
    const filter = this.get().getByRole('button', { name: `Edit filter with key ${labelName}` });
    await expect(filter).toBeVisible();
    await expect(filter).toHaveText(`${labelName} ${operator} ${labelValue}`);
  }

  async clearAdHocFilter(labelName: string) {
    await this.get()
      .getByRole('button', { name: `Remove filter with key ${labelName}` })
      .click();
    await this.page.getByTestId('metrics-drilldown-app').click(); // prevents the dropdown to appear
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
