import { DEFAULT_STATIC_URL_SEARCH_PARAMS } from '../config/constants';
import { expect, test } from '../fixtures';

test.describe('Select metric view', () => {
  test.beforeEach(async ({ selectMetricView }) => {
    await selectMetricView.goto(
      new URLSearchParams({
        from: 'now-15m',
        to: 'now',
      })
    );
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
    // FIXME: make sure they appear (the "gdev-loki" data source is provisioned - not sure where the problem is)
    // await expect(metricSceneDetails.getByText('Related logs')).toBeVisible();

    // buttons
    await expect(metricSceneDetails.getByLabel('Remove existing metric and choose a new metric')).toBeVisible();
    await expect(metricSceneDetails.getByLabel('Open in explore')).toBeVisible();
    await expect(metricSceneDetails.getByLabel('Copy url')).toBeVisible();
    await expect(metricSceneDetails.getByLabel('Bookmark')).toBeVisible();
  });

  test('Screenshot example', async ({ selectMetricView }) => {
    await selectMetricView.goto(DEFAULT_STATIC_URL_SEARCH_PARAMS);

    await expect(selectMetricView.getByTestId('scene-body')).toBeVisible();
    await expect(selectMetricView.getByTestId('scene')).toHaveScreenshot({
      stylePath: './e2e/fixtures/css/hide-app-controls.css',
    });
  });
});
