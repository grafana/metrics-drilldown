import { expect, test } from '../fixtures';

const METRIC_NAME = 'go_gc_duration_seconds';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

test.describe('Metrics Scene view', () => {
  test.beforeEach(async ({ metricSceneView }) => {
    await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
  });

  test('Core UI elements', async ({ metricSceneView }) => {
    await metricSceneView.assertCoreUI(METRIC_NAME);

    await expect(metricSceneView.getMainViz()).toHaveScreenshot('metric-scene-main-viz.png');
  });

  test.describe('Breakdown tab', () => {
    test('All labels', async ({ metricSceneView }) => {
      await metricSceneView.assertLabelDropdown('All');
      await metricSceneView.assertPanelsList();

      await expect(metricSceneView.getPanelsList()).toHaveScreenshot('metric-scene-breakdown-all-panels-list.png');
    });
  });
});
