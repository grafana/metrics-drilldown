import { expect, test } from '../fixtures';

const METRIC_NAME = 'go_gc_duration_seconds';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

test.describe('Metric Scene view', () => {
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

  test.describe('Tabs', () => {
    test.beforeEach(async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
    });

    test.describe('Breakdown tab', () => {
      // eslint-disable-next-line playwright/expect-expect
      test('All labels', async ({ metricSceneView }) => {
        await metricSceneView.assertDefaultBreadownListControls();
        await metricSceneView.assertPanelsList();
      });
    });

    test.describe('Related metrics tab', () => {
      test.beforeEach(async ({ metricSceneView }) => {
        await metricSceneView.selectTab('Related metrics');
      });

      test('All metric names', async ({ metricSceneView }) => {
        await metricSceneView.assertRelatedMetricsListControls();
        await metricSceneView.assertPanelsList();
      });

      test('View by metric prefix', async ({ metricSceneView }) => {
        await metricSceneView.selectPrefixFilterOption('go');
        await metricSceneView.assertPanelsList();
      });
    });
  });
});
