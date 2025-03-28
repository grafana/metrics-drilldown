import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL } from '../../../src/constants';

export class MetricsReducerView extends DrilldownView {
  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));
  }

  gotoVariant(variantPath: string, urlSearchParams = new URLSearchParams()) {
    super.setPathName(`${PLUGIN_BASE_URL}${variantPath}`);
    return super.goto(new URLSearchParams([...this.urlParams, ...new URLSearchParams(urlSearchParams)]));
  }

  /* Header controls */

  getHeaderControls() {
    return this.getByTestId('header-controls');
  }

  /* Quick filter */

  getQuickFilterInput() {
    return this.getHeaderControls().getByPlaceholder('Search metrics');
  }

  async assertQuickFilter(expectedValue: string, expectedResultsCount: number) {
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

  /* Layout switcher */

  getLayoutSwitcher() {
    return this.getByLabel('Layout switcher');
  }

  async assertSelectedLayout(expectedLayoutName: 'Grid' | 'Row') {
    const layoutName = await this.getLayoutSwitcher().locator('input[checked]~label').textContent();
    await expect(layoutName?.trim()).toBe(expectedLayoutName);
  }

  selectLayout(layoutName: string) {
    return this.getLayoutSwitcher().getByLabel(layoutName).click();
  }

  /* Metrics list */

  getMetricsList() {
    return this.getByTestId('metrics-list');
  }
}
