import { expect, test } from '../fixtures';

// Keep this in sync with MAX_RECENT_METRICS in MetricsSorter.tsx
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
      // We'll select seven metrics to test that only the six most
      // recent metrics are shown above the alphabetical list.
      const metricsToSelect = [
        'billing_get_billing_role_duration_bucket',
        'grafana_access_permissions_duration_sum',
        'process_virtual_memory_max_bytes',
        'net_conntrack_dialer_conn_established_total',
        'go_cpu_classes_idle_cpu_seconds_total',
        'scrape_duration_seconds',
        'openfga_cachecontroller_cache_hit_count',
      ];
      const sixMostRecentMetrics = metricsToSelect.slice(metricsToSelect.length - MAX_RECENT_METRICS).reverse();

      for (const metric of metricsToSelect) {
        const metricPrefix = metric.split('_')[0];
        await metricsReducerView.selectPrefixFilter(metricPrefix);
        await metricsReducerView.selectMetric(metric);

        // Temporary hack to get back to the Metrics Reducer view,
        // instead of relying on browser navigation or the "Select new metric" button.
        await metricsReducerView.gotoVariant('/trail-filters-sidebar');

        await metricsReducerView.waitForMetricsUpdate();
      }

      // Verify the order in the metrics list
      const metrics = await metricsReducerView.getVisibleMetrics();
      expect(metrics.length).toBeGreaterThan(MAX_RECENT_METRICS);

      // Recent metrics should appear first
      for (let i = 0; i < MAX_RECENT_METRICS; i++) {
        expect(metrics[i]).toBe(sixMostRecentMetrics[i]);
      }

      // Remaining metrics should be in alphabetical order
      const remainingMetrics = metrics.slice(MAX_RECENT_METRICS);
      const sortedRemaining = [...remainingMetrics].sort((a, b) => {
        if (!a || !b) {
          return 0;
        }
        return a.localeCompare(b);
      });
      expect(remainingMetrics).toEqual(sortedRemaining);
    });

    test('Dashboard usage sorting shows most used metrics first', async ({ metricsReducerView }) => {
      await metricsReducerView.changeSortOption('Dashboard Usage');
      await metricsReducerView.waitForMetricsUpdate();

      // Verify metrics are sorted by dashboard usage count
      const metrics = await metricsReducerView.getVisibleMetrics();
      const usageCounts = await metricsReducerView.getMetricUsageCounts();

      // Check that metrics are in descending order of usage
      for (let i = 0; i < metrics.length - 1; i++) {
        const currentUsage = usageCounts[metrics[i]] || 0;
        const nextUsage = usageCounts[metrics[i + 1]] || 0;
        expect(currentUsage).toBeGreaterThanOrEqual(nextUsage);
      }
    });

    test('Alerting usage sorting shows most used metrics first', async ({ metricsReducerView }) => {
      await metricsReducerView.changeSortOption('Alerting Usage');
      await metricsReducerView.waitForMetricsUpdate();

      // Verify metrics are sorted by alerting usage count
      const metrics = await metricsReducerView.getVisibleMetrics();
      const usageCounts = await metricsReducerView.getMetricUsageCounts();

      // Check that metrics are in descending order of usage
      for (let i = 0; i < metrics.length - 1; i++) {
        const currentUsage = usageCounts[metrics[i]] || 0;
        const nextUsage = usageCounts[metrics[i + 1]] || 0;
        expect(currentUsage).toBeGreaterThanOrEqual(nextUsage);
      }
    });
  });
});
