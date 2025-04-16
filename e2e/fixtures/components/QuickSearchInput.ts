import { type Page } from '@playwright/test';

export class QuickSearch {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  getInput() {
    return this.page.getByRole('textbox', { name: 'Quick search metrics...' });
  }

  async enterText(searchText: string) {
    await this.getInput().fill(searchText);
    await this.page.waitForTimeout(250); // see SceneQuickFilter.DEBOUNCE_DELAY
  }

  async assert(expectedValue: string, expectedResultsCount: string) {
    await expect(this.getInput()).toHaveValue(expectedValue);
    await expect(this.page.getByTestId('quick-filter-results-count')).toHaveText(expectedResultsCount);
  }
}
