import { expect, type Locator, type Mouse, type Page } from '@playwright/test';

export class Sidebar {
  private readonly locator: Locator;
  private readonly mouse: Mouse;

  private static readonly BUTTON_NAMES = [
    'Rules filters',
    'Prefix filters',
    'Suffix filters',
    'Group by labels',
    'Bookmarks',
    'Settings',
  ] as const;

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

  async toggleButton(buttonName: (typeof Sidebar.BUTTON_NAMES)[number]) {
    await this.locator.getByRole('button', { name: buttonName }).click();
    await this.mouse.move(0, 0); // prevents the tooltip to cover controls within the side bar
  }

  async assertAllButtons() {
    for (const buttonName of Sidebar.BUTTON_NAMES) {
      await expect(this.locator.getByRole('button', { name: new RegExp(buttonName, 'i') })).toBeVisible();
    }
  }

  async selectPrefixFilters(prefixes: string[]) {
    await this.locator.getByRole('button', { name: 'Prefix filters' }).click();
    for (const prefix of prefixes) {
      await this.locator.getByTitle(prefix, { exact: true }).locator('label').click();
    }
  }

  async selectSuffixFilters(suffixes: string[]) {
    await this.locator.getByRole('button', { name: 'Suffix filters' }).click();
    for (const suffix of suffixes) {
      await this.locator.getByTitle(suffix, { exact: true }).locator('label').click();
    }
  }

  async selectGroupByLabel(labelName: string) {
    await this.toggleButton('Group by labels');
    await this.locator.getByRole('radio', { name: labelName, exact: true }).check({ force: true });
  }

  async assertGroupByLabelChecked(labelName: string, shouldBeChecked = true) {
    const labelsBrowser = this.locator.getByTestId('labels-browser');
    const radioButton = labelsBrowser.getByRole('radio', { name: labelName, exact: true });

    if (shouldBeChecked) {
      await expect(radioButton).toBeChecked();
    } else {
      await expect(radioButton).not.toBeChecked();
    }
  }

  async getSidebarToggle(name: string) {
    return this.get().getByTestId(`sidebar-component ${name}`);
  }

  /* Bookmarks */

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
