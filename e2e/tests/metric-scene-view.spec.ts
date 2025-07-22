import { test } from '../fixtures';

const METRIC_NAME = 'go_gc_duration_seconds';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

test.describe('Metrics Scene view', () => {
  test.beforeEach(async ({ metricSceneView }) => {
    await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
  });

  test('Core UI elements', async ({ metricSceneView, expectToHaveScreenshot }) => {
    await metricSceneView.assertCoreUI(METRIC_NAME);
    await metricSceneView.assertDefaultBreadownListControls();

    await expectToHaveScreenshot(metricSceneView.getMainViz(), 'metric-scene-main-viz.png');
  });

  test.describe('Breakdown tab', () => {
    test('All labels', async ({ metricSceneView, expectToHaveScreenshot }) => {
      await metricSceneView.assertDefaultBreadownListControls();
      await metricSceneView.assertPanelsList();

      await expectToHaveScreenshot(metricSceneView.getPanelsList(), 'metric-scene-breakdown-all-panels-list.png');
    });

    test.describe('After selecting a label', () => {
      test.beforeEach(async ({ metricSceneView }) => {
        const LABEL = 'quantile'; // label chosen to test the outlying series detection (other labels won't have any outlier detected)
        await metricSceneView.selectLabel(LABEL);
        await metricSceneView.assertBreadownListControls({ label: LABEL, sortBy: 'Outlying series' });
      });

      test.describe('Sort by', () => {
        test('Displays panels sorted by the selected criteria', async ({ metricSceneView, expectToHaveScreenshot }) => {
          await metricSceneView.assertPanelsList();
          await expectToHaveScreenshot(
            metricSceneView.getPanelsList(),
            'metric-scene-breakdown-label-sort-outlying-panels-list.png'
          );

          await metricSceneView.selectSortByOption('Name [Z-A]');
          await metricSceneView.assertPanelsList();

          await expectToHaveScreenshot(
            metricSceneView.getPanelsList(),
            'metric-scene-breakdown-label-sort-alpha-z-a-panels-list.png'
          );

          await metricSceneView.selectSortByOption('Name [A-Z]');
          await metricSceneView.assertPanelsList();

          await expectToHaveScreenshot(
            metricSceneView.getPanelsList(),
            'metric-scene-breakdown-label-sort-alpha-a-z-panels-list.png'
          );
        });
      });

      test.describe('Quick search', () => {
        test('Filters the panels', async ({ metricSceneView, expectToHaveScreenshot }) => {
          await metricSceneView.selectSortByOption('Name [Z-A]');
          await metricSceneView.quickSearchLabelValues.enterText('5');

          await metricSceneView.assertPanelsList();

          await expectToHaveScreenshot(
            metricSceneView.getPanelsList(),
            'metric-scene-breakdown-label-quicksearch-panels-list.png'
          );
        });
      });
    });
  });

  test.describe('Related metric tab', () => {
    test.beforeEach(async ({ metricSceneView }) => {
      await metricSceneView.selectTab('Related metrics');
    });

    test('All metric names', async ({ metricSceneView, expectToHaveScreenshot }) => {
      await metricSceneView.assertRelatedMetricsListControls();
      await metricSceneView.assertPanelsList();

      await expectToHaveScreenshot(metricSceneView.getTabContent(), 'metric-scene-related-metrics-all-list.png', {
        stylePath: ['./e2e/fixtures/css/hide-app-controls.css', './e2e/fixtures/css/hide-metric-scene-top-view.css'],
      });
    });

    test('View by metric prefix', async ({ metricSceneView, expectToHaveScreenshot }) => {
      await metricSceneView.selectPrefixFilterOption('go');
      await metricSceneView.assertPanelsList();

      await expectToHaveScreenshot(
        metricSceneView.getTabContent(),
        'metric-scene-related-metrics-prefix-filtered-list.png',
        {
          stylePath: ['./e2e/fixtures/css/hide-app-controls.css', './e2e/fixtures/css/hide-metric-scene-top-view.css'],
        }
      );
    });
  });
});
