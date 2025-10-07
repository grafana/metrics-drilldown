import { expect, test } from '../fixtures';

const METRIC_NAME = 'go_gc_duration_seconds';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

test.describe('Metric Scene view', () => {
  // eslint-disable-next-line playwright/expect-expect
  test('Core UI elements', async ({ metricSceneView }) => {
    await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
    await metricSceneView.assertCoreUI(METRIC_NAME);
    await metricSceneView.assertDefaultBreadownListControls();
    await metricSceneView.assertMainPanelMenu(['Explore', 'Copy URL']); // after screenshot to prevent the menu from appearing in it
  });

  test.describe('Main viz', () => {
    test('Shows "Explore" and "Copy URL" items in main panel menu', async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
      await metricSceneView.assertMainViz(METRIC_NAME);

      await metricSceneView.openMainPanelMenu();

      await expect(metricSceneView.getByRole('menuitem', { name: 'Explore' })).toBeVisible();
      await expect(metricSceneView.getByRole('menuitem', { name: 'Copy URL' })).toBeVisible();
    });
  });
});
