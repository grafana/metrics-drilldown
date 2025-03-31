import { expect, test } from '../e2e/fixtures';
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
    await expect(metricSceneDetails.getByLabel('Copy url')).toBeVisible();
    await expect(metricSceneDetails.getByLabel('Bookmark')).toBeVisible();
  });

  test('Filtering by Label', async ({ selectMetricView }) => {
    await selectMetricView.setAdHocFilter('label with 📈', 'metrics');

    await expect(selectMetricView.getByText('label with 📈 = metrics')).toBeVisible();
    await expect(selectMetricView.getPanelByTitle('a.utf8.metric 🤘')).toBeVisible();
    await expect(selectMetricView.getPanelByTitle('a_utf8_http_requests_total')).toBeVisible();
  });

  test('Open in Explore', async ({ selectMetricView }) => {
    const explorePage = await selectMetricView.openPanelInExplore('a.utf8.metric 🤘');
    await expect(explorePage.getByRole('code').getByText('"a.utf8.metric 🤘"')).toBeVisible();
  });
});
