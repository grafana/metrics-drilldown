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

  test.describe('Related metric tab', () => {
    test.beforeEach(async ({ metricSceneView }) => {
      await metricSceneView.selectTab('Related metrics');
    });

    test('All metric names', async ({ metricSceneView }) => {
      await metricSceneView.assertRelatedMetricsListControls();
      await metricSceneView.assertPanelsList();

      await expect(metricSceneView.getTabContent()).toHaveScreenshot('metric-scene-related-metrics-all-list.png', {
        stylePath: ['./e2e/fixtures/css/hide-app-controls.css', './e2e/fixtures/css/hide-metric-scene-top-view.css'],
      });
    });

    test('View by metric prefix', async ({ metricSceneView }) => {
      await metricSceneView.selectPrefixFilterOption('go');
      await metricSceneView.assertPanelsList();

      await expect(metricSceneView.getTabContent()).toHaveScreenshot(
        'metric-scene-related-metrics-prefix-filtered-list.png',
        {
          stylePath: ['./e2e/fixtures/css/hide-app-controls.css', './e2e/fixtures/css/hide-metric-scene-top-view.css'],
        }
      );
    });
  });
});
