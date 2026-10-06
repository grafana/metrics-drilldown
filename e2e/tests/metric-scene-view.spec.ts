import { expect, test } from '../fixtures';

const METRIC_NAME = 'go_gc_duration_seconds';
const URL_SEARCH_PARAMS_WITH_METRIC_NAME = new URLSearchParams([['metric', METRIC_NAME]]);

test.describe('Metric Scene view', () => {
  // eslint-disable-next-line playwright/expect-expect
  test('Core UI elements', async ({ metricSceneView }) => {
    await metricSceneView.goto(URL_SEARCH_PARAMS_WITH_METRIC_NAME);
    await metricSceneView.assertCoreUI(METRIC_NAME);
    await metricSceneView.assertDefaultBreadownListControls();
    await metricSceneView.assertMainPanelMenu(['Explore', 'Copy URL']);
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

  test.describe('Histogram metrics', () => {
    const HISTOGRAM_METRIC_NAME = 'http_server_duration_milliseconds_bucket';

    test.beforeEach(async ({ metricSceneView }) => {
      await metricSceneView.goto(new URLSearchParams([['metric', HISTOGRAM_METRIC_NAME]]));
    });

    test('Displays the main viz as a heatmap by default', async ({ metricSceneView }) => {
      await metricSceneView.assertMainViz(HISTOGRAM_METRIC_NAME);
      await expect(metricSceneView.getMainViz()).toBeVisible();
    });

    test('Allows the user to see percentiles', async ({ metricSceneView }) => {
      const mainViz = metricSceneView.getMainViz();
      await mainViz.getByRole('radio', { name: 'percentiles' }).click();

      await metricSceneView.assertMainViz(HISTOGRAM_METRIC_NAME);
      await expect(mainViz).toBeVisible();
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

      test('Remembers the sync y-axis setting after a reload', async ({ metricSceneView }) => {
        await metricSceneView.setSyncYAxis(false);
        await expect(metricSceneView.getSyncYAxisSwitch()).not.toBeChecked();

        await metricSceneView.reload();

        await expect(metricSceneView.getSyncYAxisSwitch()).not.toBeChecked();
        await metricSceneView.assertPanelsList();
      });

      test('Rebuilds the panels when toggled after changing the label', async ({ metricSceneView }) => {
        // changing the label remounts the switch, which used to drop the listener that rebuilds the panels
        await metricSceneView.selectLabel('quantile');
        const panelKeyBefore = await metricSceneView.getFirstPanelKey();

        await metricSceneView.setSyncYAxis(false);

        await expect.poll(() => metricSceneView.getFirstPanelKey()).not.toBe(panelKeyBefore);
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

            // Verify panels list is visible after filtering
            await expect(metricSceneView.getPanelsList()).toBeVisible();
          });
        });

        test.describe('Sort by', () => {
          test('Reversed alphabetical order [Z-A]', async ({ metricSceneView }) => {
            await metricSceneView.assertPanelsList();
            await metricSceneView.selectSortByOption('Name [Z-A]');
            await metricSceneView.assertPanelsList();

            await expect(metricSceneView.getPanelsList()).toBeVisible();
          });

          test('Alphabetical order [A-Z]', async ({ metricSceneView }) => {
            await metricSceneView.assertPanelsList();
            await metricSceneView.selectSortByOption('Name [A-Z]');
            await metricSceneView.assertPanelsList();

            await expect(metricSceneView.getPanelsList()).toBeVisible();
          });

          test('Outlying series', async ({ metricSceneView }) => {
            await metricSceneView.assertPanelsList();
            await metricSceneView.selectSortByOption('Outlying series');
            await metricSceneView.assertPanelsList();

            await expect(metricSceneView.getPanelsList()).toBeVisible();
          });
        });

        test.describe('Single view', () => {
          test('Displays a single panel with all the label values series', async ({ metricSceneView }) => {
            await metricSceneView.selectLayout('single');

            await expect(metricSceneView.getSingleBreakdownPanel()).toBeVisible();
            await expect(metricSceneView.getPanelsList()).toBeVisible();
          });
        });

        test.describe('Sync y-axis', () => {
          test('Is shown in the Rows layout', async ({ metricSceneView }) => {
            await metricSceneView.selectLayout('rows');

            await expect(metricSceneView.getSyncYAxisSwitch()).toBeChecked();
          });

          test('Is hidden in the Single layout', async ({ metricSceneView }) => {
            await metricSceneView.selectLayout('single');

            await expect(metricSceneView.getSingleBreakdownPanel()).toBeVisible();
            await expect(metricSceneView.getSyncYAxisSwitch()).toBeHidden();
          });

          test('Keeps the selected layout when turned off', async ({ metricSceneView }) => {
            await metricSceneView.selectLayout('rows');
            await metricSceneView.setSyncYAxis(false);

            await expect(metricSceneView.getSyncYAxisSwitch()).not.toBeChecked();
            // assertSelectedLayout reads the `checked` attribute, which React only sets on mount, so it can lag
            // behind the URL-restored layout of the rebuilt list; toBeChecked reads the live property
            await expect(metricSceneView.getLayoutSwitcher().getByRole('radio', { name: 'Rows' })).toBeChecked();
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

        await expect(metricSceneView.getTabContent()).toBeVisible();
      });

      test('View by metric prefix', async ({ metricSceneView }) => {
        await metricSceneView.selectPrefixFilterOption('go');
        await metricSceneView.assertPanelsList();

        await expect(metricSceneView.getTabContent()).toBeVisible();
      });
    });

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
