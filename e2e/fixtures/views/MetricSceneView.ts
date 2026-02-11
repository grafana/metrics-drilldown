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
    // Wait for the visualization panel to render (including native histograms)
    await expect(this.getMainViz()).toBeVisible();
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
    await expect(panelsList.locator('[data-viz-panel-key]').first()).toBeVisible();
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

    // Retry until assertion passes (handles DOM updates during render)
    await expect(async () => {
      const radioButton = container.getByRole('radio', { name: label });
      const combobox = container.getByRole('combobox');

      if ((await radioButton.count()) > 0) {
        await expect(radioButton).toBeChecked();
      } else {
        await expect(combobox).toHaveValue(label);
      }
    }).toPass();
  }

  async selectLabel(label: string) {
    const container = this.getLabelSelectorContainer();
    const radioButton = container.getByRole('radio', { name: label });

    // Wait for the specific radio button to appear (only exists after loading completes in radio mode)
    // Use 2s timeout - if it doesn't appear, we fall back to combobox
    const hasRadioButton = await radioButton
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false);

    if (hasRadioButton) {
      await radioButton.click();
    } else {
      const combobox = container.getByRole('combobox');
      await combobox.waitFor({ state: 'visible' });
      await combobox.click();
      const option = this.getByRole('option', { name: label });
      await option.waitFor({ state: 'visible' });
      await option.click();
    }

    // Wait for panels to re-render after label selection
    await expect(this.getPanelsList().locator('[data-viz-panel-key]').first()).toBeVisible();
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
    // Wait for panels to re-render after sort
    await expect(this.getPanelsList().locator('[data-viz-panel-key]').first()).toBeVisible();
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
    // Wait for panels to re-render after filter selection
    await expect(this.getPanelsList().locator('[data-viz-panel-key]').first()).toBeVisible();
  }

  /* Saved queries */

  getSaveQueryButton() {
    return this.getByRole('button', { name: 'Save query' });
  }

  getLoadQueryButton() {
    return this.getByRole('button', { name: /saved query/ });
  }

  getSaveModal() {
    return this.getByRole('dialog', { name: /Save current query/i });
  }

  getLoadModal() {
    return this.getByRole('dialog', { name: /Load a previously saved query/i });
  }

  async openSaveModal() {
    await this.getSaveQueryButton().click();
    await expect(this.getSaveModal()).toBeVisible();
  }

  async saveQuery(title: string, description?: string) {
    await this.openSaveModal();
    const modal = this.getSaveModal();
    await modal.getByLabel('Title').fill(title);
    if (description) {
      await modal.getByLabel('Description').fill(description);
    }
    await modal.getByRole('button', { name: 'Save' }).click();
    // Dismiss success toast (same pattern as selectAndApplyConfigPreset)
    const successToast = this.getByTestId('data-testid Alert success');
    await expect(successToast).toBeVisible();
    await successToast.getByRole('button', { name: /close alert/i }).click();
  }

  async openLoadModal() {
    await this.getLoadQueryButton().click();
    await expect(this.getLoadModal()).toBeVisible();
  }

  async selectSavedQueryInList(title: string) {
    await this.getLoadModal().getByRole('radio', { name: title }).click();
  }

  async deleteSelectedQuery() {
    await this.getLoadModal().getByRole('button', { name: 'Remove' }).click();
  }

  getLoadModalSelectLink() {
    return this.getLoadModal().getByRole('link', { name: 'Select' });
  }

  async assertLoadModalDetails(expected: { title: string; query: string; description?: string }) {
    const modal = this.getLoadModal();
    await expect(modal.getByRole('heading', { name: expected.title })).toBeVisible();
    await expect(modal.locator('code')).toHaveText(expected.query);
    if (expected.description) {
      await expect(modal.getByText(expected.description)).toBeVisible();
    }
  }

  async assertLoadModalEmpty() {
    await expect(this.getLoadModal().getByText('No saved queries to display.')).toBeVisible();
  }
}
