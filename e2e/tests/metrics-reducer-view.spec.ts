import { DEFAULT_STATIC_URL_SEARCH_PARAMS } from '../config/constants';
import { expect, test } from '../fixtures';
import { type SortOption } from '../fixtures/views/MetricsReducerView';

test.describe('Metrics reducer view', () => {
  test('Core UI elements', async ({ metricsReducerView }) => {
    await metricsReducerView.gotoVariant('/drilldown');
    await metricsReducerView.assertListControls();
    await metricsReducerView.assertSidebar();
    await metricsReducerView.assertMetricsList();
  });

  test.describe('Metrics sorting', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant('/drilldown', DEFAULT_STATIC_URL_SEARCH_PARAMS);
    });

    test('Default sorting shows recent metrics first, then alphabetical', async ({ metricsReducerView, page }) => {
      // We'll select seven metrics, but only the six most recent
      // metrics shoul shown above the alphabetical list.
      const metricsToSelect = [
        'go_cgo_go_to_c_calls_calls_total', // This one should not appear in the screenshot
        'grafana_access_evaluation_duration_bucket',
        'process_network_transmit_bytes_total',
        'memberlist_client_cas_success_total',
        'net_conntrack_dialer_conn_established_total',
        'handler_duration_seconds_count',
        'jaeger_tracer_finished_spans_total',
      ];

      for (const metric of metricsToSelect) {
        await metricsReducerView.quickSearch.enterText(metric); // search for the metric
        await page.getByTestId(`select-action-${metric}`).click(); // select the metric
        await page.goBack(); // return to the metrics reducer view
      }

      await metricsReducerView.quickSearch.clear();
      await metricsReducerView.assertMetricsList();
      await expect(page).toHaveScreenshot({
        stylePath: './e2e/fixtures/css/hide-app-controls.css',
      });
    });

    const usageTypeSortOptions: Array<{ usageType: 'dashboard' | 'alerting'; sortOption: SortOption }> = [
      { usageType: 'dashboard', sortOption: 'Dashboard Usage' },
      { usageType: 'alerting', sortOption: 'Alerting Usage' },
    ];

    usageTypeSortOptions.forEach(({ usageType, sortOption }) => {
      test(`Usage sorting for ${usageType} shows most used metrics first`, async ({ metricsReducerView }) => {
        await metricsReducerView.changeSortOption(sortOption);

        // Wait for the usage count to load
        // eslint-disable-next-line sonarjs/no-nested-functions
        await expect(async () => {
          const firstPanel = await metricsReducerView.getByTestId('with-usage-data-preview-panel').first();
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

  test.describe('Sidebar buttons', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant('/drilldown', DEFAULT_STATIC_URL_SEARCH_PARAMS);
    });

    test.describe('Bookmarks', () => {
      test('New bookmarks appear in the sidebar', async ({ metricsReducerView, page }) => {
        const panelTitle = 'deprecated_flags_inuse_total';
        await metricsReducerView.selectMetricPanel(panelTitle);
        await metricsReducerView.createBookmark();
        await metricsReducerView.assertBookmarkAlert();
        await page.goBack();
        await metricsReducerView.toggleSideBarButton('Bookmarks');
        await metricsReducerView.assertBookmarkCreated(panelTitle);
      });
    });

    test.describe('Group by label', () => {
      test('A list of metrics is shown when metrics are grouped by label', async ({ page, metricsReducerView }) => {
        await metricsReducerView.selectGroupByLabel('action');
        await metricsReducerView.assertMetricsGroupByList();
        await expect(page).toHaveScreenshot({
          stylePath: './e2e/fixtures/css/hide-app-controls.css',
        });
      });
    });
  });

  test.describe('Metrics counts', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant('/drilldown', DEFAULT_STATIC_URL_SEARCH_PARAMS);
    });

    test.describe('Filter logic behavior', () => {
      test('Within a filter group, selections use OR logic (prefix.one OR prefix.two)', async ({
        metricsReducerView,
        page,
      }) => {
        await metricsReducerView.assertMetricsList();

        // Select multiple prefixes to demonstrate OR behavior within a group
        await metricsReducerView.selectPrefixFilters(['prometheus', 'pyroscope']);

        // Verify OR behavior by checking that metrics with either prefix are shown
        await expect(page).toHaveScreenshot('prefixes-selected-metric-counts.png');
      });

      test('Between filter groups, selections use AND logic ((prefix.one OR prefix.two) AND (suffix.one OR suffix.two))', async ({
        metricsReducerView,
        page,
      }) => {
        await metricsReducerView.assertMetricsList();

        // First select prefixes
        await metricsReducerView.selectPrefixFilters(['prometheus', 'pyroscope']);

        // Then select suffixes to demonstrate AND behavior between groups
        await metricsReducerView.selectSuffixFilters(['bytes', 'count']);

        // Verify AND behavior between filter groups
        await expect(page).toHaveScreenshot('prefixes-and-suffixes-selected-metric-counts.png');
      });
    });
  });
});
