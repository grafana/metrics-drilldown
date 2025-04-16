import { expect, test } from '../fixtures';

// Keep this in sync with MAX_RECENT_METRICS in MetricsSorter.tsx
// If updating MAX_RECENT_METRICS, also update the tests below.
const MAX_RECENT_METRICS = 6;

test.describe('Metrics reducer view', () => {
  test.beforeEach(async ({ metricsReducerView }) => {
    // TEMP
    await metricsReducerView.gotoVariant('/trail-filters-sidebar');
  });

  test('Core UI elements', async ({ metricsReducerView }) => {
    await metricsReducerView.assertListControls();
    await metricsReducerView.assertSidebar();
    await metricsReducerView.assertMetricsList();
  });

  test.describe('Metrics sorting', () => {
    test('Default sorting shows recent metrics first, then alphabetical', async ({ metricsReducerView, page }) => {
      // We'll select seven metrics, but only the six most recent
      // metrics shoul shown above the alphabetical list.
      const metricsToSelect = [
        'go_cgo_go_to_c_calls_calls_total', // This one should not appear in the screenshot
        'grafana_access_evaluation_duration_bucket',
        'process_virtual_memory_max_bytes',
        'go_cpu_classes_idle_cpu_seconds_total',
        'net_conntrack_dialer_conn_established_total',
        'scrape_duration_seconds',
        'openfga_cachecontroller_cache_hit_count',
      ];
      const searchInput = page.getByRole('textbox', { name: 'Quick search metrics...' });

      for (const metric of metricsToSelect) {
        await searchInput.fill(metric);
        await metricsReducerView.selectMetricAndReturnToMetricsReducer(metric);
      }

      // Begin the process of verifying the order in the metrics list
      await searchInput.clear();
      const metricsList = metricsReducerView.getMetricsList();

      // Wait for the metrics list to update after clearing the search input
      await expect(async () => {
        const visibleMetrics = await metricsReducerView.getVisibleMetrics();
        expect(visibleMetrics.length).toBeGreaterThan(MAX_RECENT_METRICS);
      }).toPass();

      // Set the viewport size to the width and height of the metrics list
      const box = await metricsList.boundingBox();

      if (!box) {
        throw new Error('Could not get element bounding box');
      }

      await page.setViewportSize({
        width: Math.ceil(box.x + box.width),
        height: Math.ceil(box.y + box.height),
      });

      // Find all panel content elements inside usage data preview panels to mask
      const panelContentLocators = page
        .getByTestId('with-usage-data-preview-panel')
        .locator('[data-testid="data-testid panel content"]');

      await expect(metricsList).toHaveScreenshot('metrics-list-default-sort.png', {
        // Without this tuned `maxDiffPixels value, the screenshot test either
        // fails erroneously or passes when it should fail, such as when the order
        // of similar metrics in the `metricsToSelect` array is changed.
        maxDiffPixels: 500,
        mask: [panelContentLocators],
      });
    });

    test('Dashboard usage sorting shows most used metrics first', async ({ metricsReducerView }) => {
      await metricsReducerView.changeSortOption('Dashboard Usage');
      await metricsReducerView.waitForMetricsWithUsage('dashboard');

      // Verify metrics are sorted by dashboard usage count
      const metrics = await metricsReducerView.getVisibleMetrics();
      const usageCounts = await metricsReducerView.getMetricUsageCounts('dashboard');

      // Check that metrics are in descending order of usage
      for (let i = 0; i < metrics.length - 1; i++) {
        const currentUsage = usageCounts[metrics[i]];
        const nextUsage = usageCounts[metrics[i + 1]];
        if (i === 0) {
          expect(currentUsage).toBeGreaterThan(0);
        }
        expect(currentUsage).toBeGreaterThanOrEqual(nextUsage);
      }
    });

    test('Alerting usage sorting shows most used metrics first', async ({ metricsReducerView }) => {
      await metricsReducerView.changeSortOption('Alerting Usage');
      await metricsReducerView.waitForMetricsWithUsage('alerting');

      // Verify metrics are sorted by alerting usage count
      const metrics = await metricsReducerView.getVisibleMetrics();
      const usageCounts = await metricsReducerView.getMetricUsageCounts('alerting');

      // Check that metrics are in descending order of usage
      for (let i = 0; i < metrics.length - 1; i++) {
        const currentUsage = usageCounts[metrics[i]];
        const nextUsage = usageCounts[metrics[i + 1]];
        if (i === 0) {
          expect(currentUsage).toBeGreaterThan(0);
        }
        expect(currentUsage).toBeGreaterThanOrEqual(nextUsage);
      }
    });
  });
});
