import { expect, type Page } from '@playwright/test';

import { DrilldownView } from './DrilldownView';
import { PLUGIN_BASE_URL } from '../../../src/shared/constants/plugin';
import { ROUTES } from '../../../src/shared/constants/routes';
import { AppControls } from '../components/AppControls';
import { QuickSearchInput } from '../components/QuickSearchInput';

export type SortByOptionNames = 'Outlying series' | 'Name [A-Z]' | 'Name [Z-A]';

export class MetricSceneView extends DrilldownView {
  public appControls: AppControls;
  public quickSearchLabelValues: QuickSearchInput;
  public quickSearchRelatedMetrics: QuickSearchInput;

  private static readonly ACTION_BAR_TABS = ['Breakdown', 'Related metrics', 'Related logs'] as const;

  constructor(readonly page: Page, defaultUrlSearchParams: URLSearchParams) {
    super(page, PLUGIN_BASE_URL, new URLSearchParams(defaultUrlSearchParams));

    this.appControls = new AppControls(page);
    this.quickSearchLabelValues = new QuickSearchInput(page, 'Quick search label values');
    this.quickSearchRelatedMetrics = new QuickSearchInput(page, 'Quick search related metrics');
  }

  /* Navigation */

  goto(urlSearchParams = new URLSearchParams()) {
    super.setPathName(`${PLUGIN_BASE_URL}/${ROUTES.Drilldown}`);

    if (!urlSearchParams.has('metric')) {
      throw new Error('goto Error: No metric specified in the URL search parameters!');
    }

    // the spread order is important to override the default params (e.g. overriding "from" and "to")
    return super.goto(new URLSearchParams([...urlSearchParams, ...this.urlParams]));
  }

  /* Core UI assertions */

  async assertCoreUI(metricName: string) {
    await this.appControls.assert();

    await this.assertMainViz(metricName);
    await expect(this.getByTestId('action-bar')).toBeVisible();

    await this.assertTabs();
  }

  /* Main vizualization */

  getMainViz() {
    return this.getByTestId('top-view').locator('[data-viz-panel-key]');
  }

  async assertMainViz(metricName: string) {
    await expect(this.getByTestId('top-view').getByRole('heading', { name: metricName })).toBeVisible();

    // we wait for some time to make sure that data is rendered, especially for native histograms
    // TODO: how to improve this and not rely on an arbitrary timeout?
    await this.waitForTimeout(1000);
  }

  async clickPanelConfigureButton() {
    await this.getMainViz().getByTestId('configure-panel').click();
  }

  getConfigureSlider() {
    return this.getByRole('dialog', { name: /drawer title configure the prometheus function/i });
  }

  /* Panel menu */

  async openMainPanelMenu() {
    const panel = this.getMainViz();
    await panel.hover();
    await panel.getByRole('button', { name: /menu/i }).click();
    await expect(this.getByTestId('panel-menu')).toBeVisible();
  }

  async assertMainPanelMenu(menuItems: string[]) {
    await this.openMainPanelMenu();
    for (const name of menuItems) {
      await expect(this.getByRole('menuitem', { name })).toBeVisible();
    }
  }

  async selectAndApplyConfigPreset(presetName: string, presetParams: string[]) {
    const configureSlider = this.getConfigureSlider();
    await configureSlider.getByTitle(presetName).click(); // clicking anywhere inside the preset div works ;)

    if (presetParams.length) {
      // presetParams only holds the names of the percentiles to click on (check or uncheck)
      for (const percentileName of presetParams) {
        await configureSlider.getByLabel(percentileName).click();
      }
    }

    await configureSlider.getByRole('button', { name: /apply/i }).click();

    const succcessToast = this.getByTestId('data-testid Alert success');
    await expect(succcessToast).toBeVisible();
    await succcessToast.getByRole('button', { name: /close alert/i }).click();
  }

  async clickOnSelectNewMetric() {
    await this.getByRole('button', { name: /Remove existing metric and choose a new metric/i }).click();
  }

  /* Tabs */

  getTabsList() {
    return this.getByRole('tablist');
  }

  async assertTabs() {
    const tabsList = this.getTabsList();

    for (const tabLabel of MetricSceneView.ACTION_BAR_TABS) {
      await expect(tabsList.getByRole('tab', { name: tabLabel })).toBeVisible();
    }

    await expect(tabsList.getByRole('tab', { name: 'Breakdown', selected: true })).toBeVisible();
  }

  async selectTab(tabLabel: 'Breakdown' | 'Related metrics' | 'Related logs') {
    await this.getTabsList().getByRole('tab', { name: tabLabel }).click();
  }

  getTabContent() {
    return this.getByTestId('tab-content');
  }

  /* Layout switcher */

  getLayoutSwitcher() {
    return this.getByLabel('Layout switcher');
  }

  async assertSelectedLayout(expectedLayoutName: 'Grid' | 'Row') {
    await expect(this.getLayoutSwitcher().locator('input[checked]~label')).toContainText(expectedLayoutName);
  }

  selectLayout(layoutName: string) {
    return this.getLayoutSwitcher().getByLabel(layoutName).click();
  }

  /* Panels list */

  getPanelsList() {
    return this.getByTestId('panels-list');
  }

  async assertPanelsList() {
    const panelsList = this.getPanelsList();
    await expect(panelsList).toBeVisible();

    // we have to wait... if not, the assertion below (on the count) will fail without waiting for elements to be in the DOM
    // AFAIK, Playwright does not have an API to wait for multiple elements to be visible
    await expect(panelsList.locator('[data-viz-panel-key]').first()).toBeVisible();

    const panelsCount = await panelsList.locator('[data-viz-panel-key]').count();
    expect(panelsCount).toBeGreaterThan(0);

    // TODO: find a better way
    await this.waitForTimeout(2000); // Wait for some extra time for the panels to show data and the UI to stabilize (y-axis sync, ...)
  }

  /* Breakdown tab */

  getSingleBreakdownPanel() {
    return this.getByTestId('single-metric-panel');
  }

  async assertDefaultBreadownListControls() {
    await this.assertLabelSelector('All');
    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  getLabelSelectorContainer() {
    return this.getByTestId('breakdown-label-selector');
  }

  async assertLabelSelector(label: string) {
    const container = this.getLabelSelectorContainer();

    try {
      // Try radio button first (with short timeout since it should be immediate)
      const radioGroup = container.getByRole('radiogroup');
      await expect(radioGroup).toBeVisible({ timeout: 2000 });
      const radioOption = radioGroup.getByRole('radio', { name: label });
      await expect(radioOption).toBeChecked();
      return;
    } catch {
      // Not a radio button, must be combobox
      const combobox = container.getByRole('combobox');
      await expect(combobox).toHaveValue(label);
    }
  }

  async selectLabel(label: string) {
    const container = this.getLabelSelectorContainer();

    try {
      // Try radio button first (with short timeout since it should be immediate)
      const radioGroup = container.getByRole('radiogroup');
      await expect(radioGroup).toBeVisible({ timeout: 2000 });
      const radioOption = radioGroup.getByRole('radio', { name: label });
      await radioOption.click();
      return;
    } catch {
      // Not a radio button, must be combobox
      const combobox = container.getByRole('combobox');
      await combobox.click();

      // Wait for dropdown menu to open
      await this.getByRole('option', { name: label }).waitFor({ state: 'visible' });
      await this.getByRole('option', { name: label }).click();
    }
  }

  async assertBreadownListControls({ label, sortBy }: { label: string; sortBy: string }) {
    await this.assertLabelSelector(label);
    await expect(this.quickSearchLabelValues.get()).toBeVisible();
    await expect(this.getSortByDropdown()).toBeVisible();
    await this.assertSelectedSortBy(sortBy);
    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  getSortByDropdown() {
    return this.getByTestId('sort-by-select');
  }

  async assertSelectedSortBy(expectedSortBy: string) {
    await expect(this.getSortByDropdown().locator('input')).toHaveValue(expectedSortBy);
  }

  async selectSortByOption(optionName: SortByOptionNames) {
    await this.getSortByDropdown().locator('input').click();
    await this.getByRole('option', { name: optionName }).getByText(optionName).click();
  }

  /* Related metrics tab */

  async assertRelatedMetricsListControls() {
    await this.assertPrefixFilterDropdown('All metric names');

    await expect(this.quickSearchRelatedMetrics.get()).toBeVisible();

    await expect(this.getLayoutSwitcher()).toBeVisible();
    await this.assertSelectedLayout('Grid');
  }

  getPrefixFilterDropdown() {
    return this.getByTestId('prefix-filter-selector');
  }

  async assertPrefixFilterDropdown(optionLabel: string) {
    await expect(this.getPrefixFilterDropdown().getByRole('combobox')).toHaveValue(optionLabel);
  }

  async selectPrefixFilterOption(expectedOptionName: string) {
    await this.getPrefixFilterDropdown().getByRole('combobox').click();
    await this.getByRole('option', { name: expectedOptionName }).click();
  }
}
