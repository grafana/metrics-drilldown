import { expect, test } from '../fixtures';

const METRIC_NAME = 'go_gc_duration_seconds';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

test.describe('Metric Scene view', () => {
  test('Core UI elements', async ({ metricSceneView }) => {
    await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
    await metricSceneView.assertCoreUI(METRIC_NAME);
    await metricSceneView.assertDefaultBreadownListControls();

    await expect(metricSceneView.getMainViz()).toHaveScreenshot('metric-scene-main-viz.png');
  });

  test.describe('Histogram metrics', () => {
    const HISTOGRAM_METRIC_NAME = 'http_server_duration_milliseconds_bucket';

    test.beforeEach(async ({ metricSceneView }) => {
      await metricSceneView.goto(new URLSearchParams([['metric', HISTOGRAM_METRIC_NAME]]));
    });

    test('Displays the main viz as a heatmap by default', async ({ metricSceneView }) => {
      await metricSceneView.assertMainViz(HISTOGRAM_METRIC_NAME);
      await expect(metricSceneView.getMainViz()).toHaveScreenshot('metric-scene-main-viz-heatmap.png');
    });

    test('Allows the user to see percentiles', async ({ metricSceneView }) => {
      const mainViz = metricSceneView.getMainViz();
      await mainViz.getByRole('radio', { name: 'percentiles' }).click();

      await metricSceneView.assertMainViz(HISTOGRAM_METRIC_NAME);
      await expect(mainViz).toHaveScreenshot('metric-scene-main-viz-percentiles.png');
    });
  });

  test.describe('Tabs', () => {
    test.beforeEach(async ({ metricSceneView }) => {
      await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
    });

    test.describe('Breakdown tab', () => {
      // eslint-disable-next-line playwright/expect-expect
      test('All labels', async ({ metricSceneView, expectScreenshotInCurrentGrafanaVersion }) => {
        await metricSceneView.assertDefaultBreadownListControls();
        await metricSceneView.assertPanelsList();

        await expectScreenshotInCurrentGrafanaVersion(
          metricSceneView.getPanelsList(),
          'metric-scene-breakdown-all-panels-list.png'
        );
      });

      test.describe('After selecting a label', () => {
        test.beforeEach(async ({ metricSceneView }) => {
          const LABEL = 'quantile'; // label chosen to test the outlying series detection (other labels won't have any outlier detected)
          await metricSceneView.selectLabel(LABEL);
          await metricSceneView.assertBreadownListControls({ label: LABEL, sortBy: 'Outlying series' });
        });

        test.describe('Quick search', () => {
          test('Filters the panels', async ({ metricSceneView }) => {
            await metricSceneView.selectSortByOption('Name [Z-A]');
            await metricSceneView.quickSearchLabelValues.enterText('5');

            await metricSceneView.assertPanelsList();

            await expect(metricSceneView.getPanelsList()).toHaveScreenshot(
              'metric-scene-breakdown-label-quicksearch-panels-list.png'
            );
          });
        });

        test.describe('Sort by', () => {
          test('Reversed alphabetical order [Z-A]', async ({ metricSceneView }) => {
            await metricSceneView.assertPanelsList();
            await metricSceneView.selectSortByOption('Name [Z-A]');
            await metricSceneView.assertPanelsList();

            await expect(metricSceneView.getPanelsList()).toHaveScreenshot(
              'metric-scene-breakdown-label-sort-alpha-z-a-panels-list.png'
            );
          });

          test('Alphabetical order [A-Z]', async ({ metricSceneView }) => {
            await metricSceneView.assertPanelsList();
            await metricSceneView.selectSortByOption('Name [A-Z]');
            await metricSceneView.assertPanelsList();

            await expect(metricSceneView.getPanelsList()).toHaveScreenshot(
              'metric-scene-breakdown-label-sort-alpha-a-z-panels-list.png'
            );
          });

          test('Outlying series', async ({ metricSceneView }) => {
            await metricSceneView.assertPanelsList();
            await metricSceneView.selectSortByOption('Outlying series');
            await metricSceneView.assertPanelsList();

            await expect(metricSceneView.getPanelsList()).toHaveScreenshot(
              'metric-scene-breakdown-label-sort-outlying-panels-list.png'
            );
          });
        });

        test.describe('Single view', () => {
          test('Displays a single panel with all the label values series', async ({ metricSceneView }) => {
            await metricSceneView.selectLayout('single');

            await expect(metricSceneView.getSingleBreakdownPanel()).toBeVisible();

            await expect(metricSceneView.getPanelsList()).toHaveScreenshot(
              'metric-scene-breakdown-label-single-panel.png'
            );
          });
        });
      });
    });

    test.describe('Related metrics tab', () => {
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
            stylePath: [
              './e2e/fixtures/css/hide-app-controls.css',
              './e2e/fixtures/css/hide-metric-scene-top-view.css',
            ],
          }
        );
      });
    });

    test.describe('Metrics graph panel menu items', () => {
      test('Shows Explore and Copy URL in main panel menu', async ({ metricSceneView }) => {
        await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
        await metricSceneView.assertMainViz(METRIC_NAME);

        await metricSceneView.openMainPanelMenu();
        await metricSceneView.assertMainPanelMenuItems();
        // add screenshot here
      });
    })

    test.describe('Related logs tab', () => {
      test.beforeEach(async ({ metricSceneView }) => {
        await metricSceneView.selectTab('Related logs');
      });

      test('No related logs found', async ({ metricSceneView }) => {
        await expect(metricSceneView.getTabContent().getByText('No related logs found')).toBeVisible();
      });
    });
  });
});
