import { type Locator, type Page } from '@playwright/test';

import { expect } from '../';
import { NOTIFY_VALUE_CHANGE_DELAY } from '../../../src/MetricsReducer/list-controls/QuickSearch/constants';

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
    // Wait for the debounced quick search to process the input (include 50ms buffer)
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await this.page.waitForTimeout(NOTIFY_VALUE_CHANGE_DELAY + 50);
  }

  clear() {
    return this.get().clear();
  }

  async assert(expectedValue: string, expectedResultsCount: string) {
    await expect(this.get()).toHaveValue(expectedValue);
    await expect(this.page.getByTestId('quick-filter-results-count')).toHaveText(expectedResultsCount);
  }
}
