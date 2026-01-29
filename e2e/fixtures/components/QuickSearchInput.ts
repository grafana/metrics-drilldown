import { type Locator, type Page } from '@playwright/test';

import { expect } from '../';

export class QuickSearchInput {
  private readonly locator: Locator;

  constructor(private readonly page: Page, name: string) {
    this.locator = page.getByRole('textbox', { name });
  }

  get() {
    return this.locator;
  }

  async enterText(searchText: string) {
    await this.get().fill(searchText);
  }

  clear() {
    return this.get().clear();
  }

  async assert(expectedValue: string, expectedResultsCount: string) {
    await expect(this.get()).toHaveValue(expectedValue);
    await expect(this.page.getByTestId('quick-filter-results-count')).toHaveText(expectedResultsCount);
  }
}
