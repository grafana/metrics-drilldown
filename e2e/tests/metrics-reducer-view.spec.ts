import { UI_TEXT } from '../../src/constants/ui';
import { expect, test } from '../fixtures';
import { type SortByOptionNames } from '../fixtures/views/MetricsReducerView';

test.describe('Metrics reducer view', () => {
  test.beforeEach(async ({ metricsReducerView }) => {
    await metricsReducerView.goto();
  });

  test('Core UI elements', async ({ metricsReducerView }) => {
    await metricsReducerView.assertCoreUI();
  });

  test.describe('Sidebar', () => {
    test.describe('Prefix and suffix filters logic behavior', () => {
      test('Within a filter group, selections use OR logic (prefix.one OR prefix.two)', async ({
        metricsReducerView,
      }) => {
        await metricsReducerView.assertMetricsList();

        // Select multiple prefixes to demonstrate OR behavior within a group
        await metricsReducerView.sidebar.selectPrefixFilters(['prometheus', 'pyroscope']);

        // Verify OR behavior by checking that metrics with either prefix are shown
        await expect(metricsReducerView.page).toHaveScreenshot('sidebar-prefixes-selected-metric-counts.png');
      });

      test('Between filter groups, selections use AND logic ((prefix.one OR prefix.two) AND (suffix.one OR suffix.two))', async ({
        metricsReducerView,
      }) => {
        await metricsReducerView.assertMetricsList();

        // First select prefixes
        await metricsReducerView.sidebar.selectPrefixFilters(['prometheus', 'pyroscope']);

        // Then select suffixes to demonstrate AND behavior between groups
        await metricsReducerView.sidebar.selectSuffixFilters(['bytes', 'count']);

        // Verify AND behavior between filter groups
        await expect(metricsReducerView.page).toHaveScreenshot(
          'sidebar-prefixes-and-suffixes-selected-metric-counts.png'
        );
      });
    });

    test.describe('Group by label', () => {
      test('A list of metrics is shown when metrics are grouped by label', async ({ page, metricsReducerView }) => {
        await metricsReducerView.sidebar.selectGroupByLabel('db_name');
        await metricsReducerView.assertMetricsGroupByList();

        await expect(page).toHaveScreenshot('metrics-reducer-group-by-label.png', {
          stylePath: './e2e/fixtures/css/hide-app-controls.css',
        });
      });

      test('clearing the filter should clear the status', async ({ metricsReducerView }) => {
        await metricsReducerView.sidebar.selectGroupByLabel('db_name');
        await metricsReducerView.assertMetricsGroupByList();
        await expect(await metricsReducerView.sidebar.getSidebarToggle('Group by labels')).toContainClass('active');
        // select the first group
        // is there a nicer way of doing this?
        await metricsReducerView.getByRole('button', { name: 'Select' }).nth(1).click();
        await metricsReducerView.assertFilter('db_name');
        await metricsReducerView.clearFilter('db_name');
        // assert sidebar icon is not active
        await expect(await metricsReducerView.sidebar.getSidebarToggle('Group by labels')).not.toContainClass('active');
      });
    });

    test.describe('Bookmarks', () => {
      test('New bookmarks appear in the sidebar', async ({ metricsReducerView }) => {
        const METRIC_NAME = 'deprecated_flags_inuse_total';
        await metricsReducerView.selectMetricPanel(METRIC_NAME);

        // create bookmark
        await metricsReducerView.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.BOOKMARK_LABEL).click();
        await expect(metricsReducerView.getByText('Bookmark created')).toBeVisible();

        await metricsReducerView.goBack();

        await metricsReducerView.sidebar.toggleButton('Bookmarks');

        // TODO: use specific cata-testid with the full metric name to simplify this assertion
        // Only consider the first 20 characters, to account for truncation of long meric names
        const possiblyTruncatedMetricName = new RegExp(`^${METRIC_NAME.substring(0, 20)}`);
        await expect(metricsReducerView.getByRole('button', { name: possiblyTruncatedMetricName })).toBeVisible();
      });
    });
  });

  test.describe('Metrics sorting', () => {
    test('Default sorting shows recent metrics first, then alphabetical', async ({ metricsReducerView, page }) => {
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
        await page.goBack();
      }

      await metricsReducerView.quickSearch.clear();
      await metricsReducerView.assertMetricsList();

      await expect(page).toHaveScreenshot('metrics-reducer-default-sort.png', {
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
        // eslint-disable-next-line sonarjs/no-nested-functions
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
        for (let i = 0; i < metricNames.length - 1; i++) {
          const currentUsage = usageCounts[metricNames[i]];
          const nextUsage = usageCounts[metricNames[i + 1]];
          if (i === 0) {
            expect(currentUsage).toBeGreaterThan(0);
          }
          expect(currentUsage).toBeGreaterThanOrEqual(nextUsage);
        }
      });
    });
  });
});
