import { expect, test } from '../e2e/fixtures';
import { getGrafanaUrl } from '../playwright.config';
import { UI_TEXT } from '../src/constants/ui';

test.describe('Select metric view', () => {
  test.beforeEach(async ({ selectMetricView }) => {
    await selectMetricView.goto();
  });

  test('Core UI elements', async ({ selectMetricView }) => {
    await selectMetricView.assertTopControls();

    await expect(selectMetricView.getQuickFilterInput()).toBeVisible();

    await expect(selectMetricView.getByText('View by')).toBeVisible();

    const sceneBody = selectMetricView.getSceneBody();
    await expect(sceneBody).toBeVisible();
    const panelsCount = await sceneBody.locator('[data-viz-panel-key]').count();

    expect(panelsCount).toBeGreaterThan(0);
  });

  test('Selecting a metric', async ({ selectMetricView }) => {
    await expect(selectMetricView.getSceneBody()).toBeVisible();

    const panel = selectMetricView.locator('[data-viz-panel-key]').first();
    const panelTitle = await panel.getByTestId('header-container').locator('h2').textContent();
    await panel.getByRole('button', { name: /select/i }).click();

    // after navigation to metric scene
    const metricScene = selectMetricView.getByTestId('metric-scene');
    await expect(metricScene).toBeVisible();

    const metricScenePanel = metricScene.locator('[data-viz-panel-key]');
    await expect(metricScenePanel.getByText(panelTitle as unknown as string)).toBeVisible();

    const metricSceneDetails = selectMetricView.getByTestId('metric-scene-details');
    await expect(metricSceneDetails).toBeVisible();

    // tabs
    await expect(metricSceneDetails.getByText('Breakdown')).toBeVisible();
    await expect(metricSceneDetails.getByText('Related metrics')).toBeVisible();
    await expect(metricSceneDetails.getByText('Related logs')).toBeVisible();

    // buttons
    await expect(metricSceneDetails.getByLabel('Remove existing metric and choose a new metric')).toBeVisible();
    await expect(metricSceneDetails.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OPEN_EXPLORE_LABEL)).toBeVisible();
    await expect(metricSceneDetails.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.COPY_URL_LABEL)).toBeVisible();
    await expect(metricSceneDetails.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.BOOKMARK_LABEL)).toBeVisible();
  });

  test('Filtering by Label', async ({ selectMetricView }) => {
    await selectMetricView.setAdHocFilter('label with 📈', '=', 'metrics');
    await selectMetricView.assertAdHocFilters(['label with 📈 = metrics']);

    for (const panelTitle of ['a.utf8.metric 🤘', 'a_utf8_http_requests_total']) {
      await selectMetricView.assertPanel(panelTitle);
    }
  });

  test('Open in Explore', async ({ selectMetricView }) => {
    await selectMetricView.selectMetricPanel('a.utf8.metric 🤘');
    const explorePage = await selectMetricView.openPanelInExplore();
    await expect(explorePage.getByRole('code').getByText('"a.utf8.metric 🤘"')).toBeVisible();
  });

  test('Copy url', async ({ selectMetricView, page }) => {
    await selectMetricView.selectMetricPanel('a.utf8.metric 🤘');
    await selectMetricView.clickCopyPanelUrl();

    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    const expectedContent = `${getGrafanaUrl()}/a/grafana-metricsdrilldown-app/trail?metric=a.utf8.metric%20%F0%9F%A4%98&nativeHistogramMetric=&from=now-15m&to=now&timezone=browser&var-ds=gdev-prometheus&var-otel_resources=&var-filters=&var-otel_and_metric_filters=&var-deployment_environment=undefined&var-variant=onboard-filters-sidebar&var-labelsWingman=&actionView=breakdown&var-groupby=$__all&breakdownLayout=grid`;
    expect(clipboardContent).toBe(expectedContent);
  });

  test('Bookmark', async ({ selectMetricView }) => {
    const panelTitle = 'a.utf8.metric 🤘';
    await selectMetricView.selectMetricPanel(panelTitle);
    await selectMetricView.createBookmark();
    await selectMetricView.assertBookmarkAlert();
    await selectMetricView.seeAllBookmarksFromAlert();
    await selectMetricView.assertBookmarkCreated(panelTitle);
  });

  test('Select New Metric', async ({ selectMetricView }) => {
    await selectMetricView.selectMetricPanel('a.utf8.metric 🤘');
    await selectMetricView.selectNewMetric();
    await selectMetricView.assertTopControls();
  });
});
