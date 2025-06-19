import { expect, type Locator, type Mouse, type Page } from '@playwright/test';

const BUTTON_NAMES = [
  'Rules filters',
  'Prefix filters',
  'Suffix filters',
  'Group by labels',
  'Bookmarks',
  'Settings',
] as const;

type ButtonName = (typeof BUTTON_NAMES)[number];

export class Sidebar {
  private readonly locator: Locator;
  private readonly mouse: Mouse;

  constructor(private readonly page: Page) {
    this.locator = page.getByTestId('sidebar');
    this.mouse = page.mouse;
  }

  get() {
    return this.locator;
  }

  async assert() {
    await expect(this.get()).toBeVisible();
    await this.assertAllButtons();
  }

  /* Buttons */

  getButton(buttonName: ButtonName) {
    return this.locator.getByRole('button', { name: buttonName, exact: true });
  }

  async toggleButton(buttonName: ButtonName) {
    await this.getButton(buttonName).click();
    await this.mouse.move(0, 0); // prevents the tooltip to cover controls within the side bar
  }

  async assertAllButtons() {
    for (const buttonName of BUTTON_NAMES) {
      await expect(this.locator.getByRole('button', { name: new RegExp(buttonName, 'i') })).toBeVisible();
    }
  }

  async assertActiveButton(buttonName: ButtonName, expectToBeActive: boolean) {
    const sidebarButton = await this.getButton(buttonName);

    if (expectToBeActive) {
      await expect(sidebarButton).toContainClass('active');
    } else {
      await expect(sidebarButton).not.toContainClass('active');
    }
  }

  /* Prefix section */

  async selectPrefixFilters(prefixes: string[]) {
    await this.locator.getByRole('button', { name: 'Prefix filters' }).click();
    for (const prefix of prefixes) {
      await this.locator.getByTitle(prefix, { exact: true }).locator('label').click();
    }
  }

  /* Suffix section */

  async selectSuffixFilters(suffixes: string[]) {
    await this.locator.getByRole('button', { name: 'Suffix filters' }).click();
    for (const suffix of suffixes) {
      await this.locator.getByTitle(suffix, { exact: true }).locator('label').click();
    }
  }

  /* Group by label section */

  async selectGroupByLabel(labelName: string) {
    const labelsBrowser = this.locator.getByTestId('labels-browser');
    await labelsBrowser.getByRole('radio', { name: labelName, exact: true }).check();
  }

  async assertGroupByLabelChecked(labelName: string | null) {
    const labelsBrowser = this.locator.getByTestId('labels-browser');

    if (labelName === null) {
      const checkedRadios = labelsBrowser.getByRole('radio', { checked: true });
      await expect(checkedRadios).toHaveCount(0);
      return;
    }

    const radioButton = labelsBrowser.getByRole('radio', { name: labelName, exact: true });
    await expect(radioButton).toBeChecked();
  }

  async assertLabelsList(count: number) {
    const labelsBrowser = this.locator.getByTestId('labels-browser');
    const radios = labelsBrowser.getByRole('radio');
    await expect(radios).toHaveCount(count);
  }

  /* Bookmarks section */

  async assertBookmarkCreated(metricName: string) {
    // Only consider the first 20 characters, to account for truncation of long meric names
    const possiblyTruncatedMetricName = new RegExp(`^${metricName.substring(0, 20)}`);
    await expect(this.page.getByRole('button', { name: possiblyTruncatedMetricName })).toBeVisible();
  }

  async seeAllBookmarksFromAlert() {
    await this.page.getByRole('link', { name: 'View bookmarks' }).click();
    await this.page.getByLabel('bookmarkCarrot').click();
  }
}
