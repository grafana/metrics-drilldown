import { UI_TEXT } from '../../../src/shared/constants/ui';
import { expect, test } from '../../fixtures';
import { type SortByOptionNames } from '../../fixtures/views/MetricsReducerView';

test.describe('Metrics reducer view', () => {
  test.beforeEach(async ({ metricsReducerView }) => {
    await metricsReducerView.goto();
  });

  // eslint-disable-next-line playwright/expect-expect
  test('Core UI elements', async ({ metricsReducerView }) => {
    await metricsReducerView.assertCoreUI();
  });

  test.describe('Sidebar', () => {
    test.describe('Prefix and suffix filters logic behavior', () => {
      // eslint-disable-next-line playwright/expect-expect
      test('Within a filter group, selections use OR logic (prefix.one OR prefix.two)', async ({
        metricsReducerView,
        expectScreenshotInCurrentGrafanaVersion,
      }) => {
        await metricsReducerView.sidebar.selectPrefixFilters(['prometheus', 'pyroscope']);
        await metricsReducerView.assertMetricsList();

        // Verify OR behavior by checking that metrics with either prefix are shown
        await expectScreenshotInCurrentGrafanaVersion(
          metricsReducerView.page,
          'sidebar-prefixes-selected-metric-counts.png',
          {
            stylePath: './e2e/fixtures/css/hide-app-controls.css',
          }
        );
      });

      // eslint-disable-next-line playwright/expect-expect
      test('Between filter groups, selections use AND logic ((prefix.one OR prefix.two) AND (suffix.one OR suffix.two))', async ({
        metricsReducerView,
        expectScreenshotInCurrentGrafanaVersion,
      }) => {
        await metricsReducerView.sidebar.selectPrefixFilters(['prometheus', 'pyroscope']);
        await metricsReducerView.sidebar.selectSuffixFilters(['bytes', 'count']);
        await metricsReducerView.assertMetricsList();

        // Verify AND behavior between the two filter groups
        await expectScreenshotInCurrentGrafanaVersion(
          metricsReducerView.page,
          'sidebar-prefixes-and-suffixes-selected-metric-counts.png',
          {
            stylePath: './e2e/fixtures/css/hide-app-controls.css',
          }
        );
      });
    });

    test.describe('Group by label', () => {
      test.describe('When selecting a value in the side bar', () => {
        test('A list of metrics grouped by label values is displayed, each with a "Select" button', async ({
          metricsReducerView,
        }) => {
          await metricsReducerView.sidebar.toggleButton('Group by labels');
          await metricsReducerView.sidebar.selectGroupByLabel('db_name');
          await metricsReducerView.sidebar.assertActiveButton('Group by labels', true);
          await metricsReducerView.assertMetricsGroupByList();

          await expect(metricsReducerView.getMetricsGroupByList()).toHaveScreenshot(
            'metrics-reducer-group-by-label.png'
          );
        });

        test('When clicking on the "Select" button, it drills down the selected label value (adds a new filter, displays a non-grouped list of metrics and updates the list of label values)', async ({
          metricsReducerView,
        }) => {
          await metricsReducerView.sidebar.toggleButton('Group by labels');
          await metricsReducerView.sidebar.selectGroupByLabel('db_name');
          await metricsReducerView.assertMetricsGroupByList();

          await metricsReducerView.selectMetricsGroup('db_name', 'grafana');
          await metricsReducerView.appControls.assertAdHocFilter('db_name', '=', 'grafana');

          await metricsReducerView.sidebar.assertActiveButton('Group by labels', false);
          await metricsReducerView.sidebar.assertGroupByLabelChecked(null);
          await metricsReducerView.assertMetricsList();

          await metricsReducerView.sidebar.assertLabelsList(['db_name', 'instance', 'job']);

          await expect(metricsReducerView.getMetricsList()).toHaveScreenshot(
            'metrics-reducer-group-by-label-after-select.png'
          );
        });

        test('When clearing the filter, it updates the list of label values and marks the sidebar button as inactive', async ({
          metricsReducerView,
        }) => {
          await metricsReducerView.sidebar.toggleButton('Group by labels');
          await metricsReducerView.sidebar.selectGroupByLabel('db_name');
          await metricsReducerView.assertMetricsGroupByList();

          await metricsReducerView.selectMetricsGroup('db_name', 'grafana');
          await metricsReducerView.appControls.assertAdHocFilter('db_name', '=', 'grafana');
          await metricsReducerView.appControls.clearAdHocFilter('db_name');

          await metricsReducerView.sidebar.assertActiveButton('Group by labels', false);
          await metricsReducerView.sidebar.assertGroupByLabelChecked(null);

          await metricsReducerView.sidebar.assertLabelsListCount('>', 3);
          await metricsReducerView.assertMetricsList();

          await expect(metricsReducerView.getMetricsList()).toHaveScreenshot(
            'metrics-reducer-group-by-label-after-clear-filter.png'
          );
        });
      });
    });

    test.describe('Bookmarks', () => {
      test('Creating, going to and removing bookmarks', async ({ metricsReducerView, metricSceneView }) => {
        const METRIC_NAME = 'deprecated_flags_inuse_total';

        // select a metric and go to the metric scene
        await metricsReducerView.selectMetricPanel(METRIC_NAME);

        // create bookmark and back to metrics reducer
        await metricSceneView.getByRole('button', { name: UI_TEXT.METRIC_SELECT_SCENE.BOOKMARK_LABEL }).click();
        await metricSceneView.goBack();

        // open bookmarks and assertion
        await metricsReducerView.sidebar.toggleButton('Bookmarks');
        let bookmarkCard = metricsReducerView.getByTestId(`data-trail-card ${METRIC_NAME}`);
        await expect(bookmarkCard).toBeVisible();

        // select bookmark, assertion in the metric scene and back
        await bookmarkCard.click();
        await metricSceneView.assertCoreUI(METRIC_NAME);
        await metricSceneView.goBack();

        // remove bookmark
        await metricsReducerView.sidebar.toggleButton('Bookmarks');
        bookmarkCard = metricsReducerView.getByTestId(`data-trail-card ${METRIC_NAME}`);
        await bookmarkCard.getByRole('button', { name: 'Remove bookmark' }).click();
        await expect(bookmarkCard).toBeHidden();

        await expect(metricsReducerView.getByText('No bookmarks yet for thecurrent data source.')).toBeVisible();
      });
    });
  });

  test.describe('Metrics sorting', () => {
    // eslint-disable-next-line playwright/expect-expect
    test('Default sorting shows recent metrics first, then alphabetical', async ({
      page,
      metricsReducerView,
      metricSceneView,
      expectScreenshotInCurrentGrafanaVersion,
    }) => {
      await metricsReducerView.assertSelectedSortBy('Default');

      // We'll select seven metrics, but only the 6 most recent metrics should be shown above the alphabetical list
      const metricsToSelect = [
        'pyroscope_write_path_downstream_request_duration_seconds', // This one should not appear in the screenshot
        'grafana_access_evaluation_duration_bucket',
        'process_network_transmit_bytes_total',
        'memberlist_client_cas_success_total',
        'net_conntrack_dialer_conn_established_total',
        'handler_duration_seconds_count',
        'jaeger_tracer_finished_spans_total',
      ];

      for (const metric of metricsToSelect) {
        await metricsReducerView.quickSearch.enterText(metric);
        await metricsReducerView.selectMetricPanel(metric);
        await metricSceneView.assertMainViz(metric);
        await metricSceneView.goBack();
      }

      await metricsReducerView.quickSearch.clear();
      await metricsReducerView.assertMetricsList();

      await expectScreenshotInCurrentGrafanaVersion(page, 'metrics-reducer-default-sort.png', {
        stylePath: './e2e/fixtures/css/hide-app-controls.css',
      });
    });

    const usageTypeSortOptions: Array<{ usageType: 'dashboard' | 'alerting'; sortOptionName: SortByOptionNames }> = [
      { usageType: 'dashboard', sortOptionName: 'Dashboard Usage' },
      { usageType: 'alerting', sortOptionName: 'Alerting Usage' },
    ];

    usageTypeSortOptions.forEach(({ usageType, sortOptionName }) => {
      test(`Usage sorting for ${usageType} shows most used metrics first`, async ({ metricsReducerView }) => {
        await metricsReducerView.selectSortByOption(sortOptionName);

        // Wait for the usage count to load
        await expect(async () => {
          const firstPanel = metricsReducerView.getByTestId('with-usage-data-preview-panel').first();
          const usageElement = firstPanel.locator(`[data-testid="${usageType}-usage"]`);
          const usageCount = parseInt((await usageElement.textContent()) || '0', 10);
          expect(usageCount).toBeGreaterThan(0);
        }).toPass();

        // Verify metrics are sorted by alerting usage count
        const usageCounts: Record<string, number> = {};
        const metricPanels = await metricsReducerView.getByTestId('with-usage-data-preview-panel').all();

        // For each metric item, extract its usage counts
        for (const item of metricPanels) {
          const metricName = await item.getByRole('heading').textContent();
          expect(metricName).not.toBeNull();
          const usagePanel = item.locator('[data-testid="usage-data-panel"]');
          const usageCount = await usagePanel.locator(`[data-testid="${usageType}-usage"]`).textContent();
          usageCounts[metricName as string] = parseInt(usageCount || '0', 10);
        }
        const metricNames = Object.keys(usageCounts);

        // Check that metrics are in descending order of usage
        const currentUsage = usageCounts[metricNames[0]];
        expect(currentUsage).toBeGreaterThan(0);

        for (let i = 0; i < metricNames.length - 1; i++) {
          const currentUsage = usageCounts[metricNames[i]];
          const nextUsage = usageCounts[metricNames[i + 1]];
          expect(currentUsage).toBeGreaterThanOrEqual(nextUsage);
        }
      });
    });
  });
});
