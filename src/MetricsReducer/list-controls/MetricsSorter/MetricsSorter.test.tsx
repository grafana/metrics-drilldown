import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';

import { fetchFiringAlertRuleSignals } from './fetchers/fetchFiringAlertMetrics';
import { fetchSloMetricSignals, type SloMetricSignals } from './fetchers/fetchSloMetricSignals';
import { addRecentMetric, getRecentMetrics, MetricsSorter, sortMetricsWithRecentFirst } from './MetricsSorter';

jest.mock('./fetchers/fetchSloMetricSignals', () => ({
  fetchSloMetricSignals: jest.fn(),
}));

jest.mock('./fetchers/fetchFiringAlertMetrics', () => ({
  fetchFiringAlertRuleSignals: jest.fn(),
}));

const mockFetchFiringAlertRuleSignals = fetchFiringAlertRuleSignals as jest.MockedFunction<
  typeof fetchFiringAlertRuleSignals
>;
const mockFetchSloMetricSignals = fetchSloMetricSignals as jest.MockedFunction<typeof fetchSloMetricSignals>;

function sloResult(datasourceUid: string, status: SloMetricSignals['status'] = 'ready'): SloMetricSignals {
  return {
    datasourceUid,
    status,
    trackedMetrics: new Map(),
    activeBurnMetrics: new Set(),
  };
}

describe('MetricsSorter', () => {
  beforeEach(() => {
    userStorage.clear();
    jest.clearAllMocks();
  });

  describe('firing alert signal cache', () => {
    it('does not cache acquisition errors so later consumers can retry', async () => {
      mockFetchFiringAlertRuleSignals
        .mockResolvedValueOnce({
          status: 'error',
          metricCounts: new Map(),
          firingSloUuids: new Map(),
          ruleCount: 0,
        })
        .mockResolvedValueOnce({
          status: 'ready',
          metricCounts: new Map([['up', 1]]),
          firingSloUuids: new Map(),
          ruleCount: 1,
        });
      const sorter = new MetricsSorter({});

      await expect(sorter.getFiringAlertSignals()).resolves.toMatchObject({ status: 'error' });
      await expect(sorter.getFiringAlertSignals()).resolves.toMatchObject({ status: 'ready' });

      expect(mockFetchFiringAlertRuleSignals).toHaveBeenCalledTimes(2);
    });
  });

  describe('SLO signal cache', () => {
    it('coalesces concurrent requests and caches a ready-empty result by datasource', async () => {
      let resolve!: (value: SloMetricSignals) => void;
      mockFetchSloMetricSignals.mockReturnValue(new Promise((done) => (resolve = done)));
      const sorter = new MetricsSorter({});

      const first = sorter.getSloMetricSignals('prom-a');
      const second = sorter.getSloMetricSignals('prom-a');
      expect(mockFetchSloMetricSignals).toHaveBeenCalledTimes(1);

      resolve(sloResult('prom-a'));
      await expect(first).resolves.toMatchObject({ status: 'ready' });
      await expect(second).resolves.toMatchObject({ status: 'ready' });
      await sorter.getSloMetricSignals('prom-a');
      expect(mockFetchSloMetricSignals).toHaveBeenCalledTimes(1);
    });

    it('rate-limits error retries while allowing the same datasource to recover', async () => {
      jest.useFakeTimers().setSystemTime(1_000);
      mockFetchSloMetricSignals
        .mockResolvedValueOnce(sloResult('prom-a', 'error'))
        .mockResolvedValueOnce(sloResult('prom-a'));
      const sorter = new MetricsSorter({});

      try {
        await expect(sorter.getSloMetricSignals('prom-a')).resolves.toMatchObject({ status: 'error' });
        await expect(sorter.getSloMetricSignals('prom-a')).resolves.toMatchObject({ status: 'error' });
        expect(mockFetchSloMetricSignals).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(5_000);
        await expect(sorter.getSloMetricSignals('prom-a')).resolves.toMatchObject({ status: 'ready' });
        expect(mockFetchSloMetricSignals).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('clears an unexpected rejected promise so the same datasource can retry', async () => {
      mockFetchSloMetricSignals
        .mockRejectedValueOnce(new Error('unexpected failure'))
        .mockResolvedValueOnce(sloResult('prom-a'));
      const sorter = new MetricsSorter({});

      await expect(sorter.getSloMetricSignals('prom-a')).rejects.toThrow('unexpected failure');
      await expect(sorter.getSloMetricSignals('prom-a')).resolves.toMatchObject({ status: 'ready' });

      expect(mockFetchSloMetricSignals).toHaveBeenCalledTimes(2);
    });

    it('never reuses membership from another datasource', async () => {
      mockFetchSloMetricSignals.mockImplementation(async (uid) => sloResult(uid));
      const sorter = new MetricsSorter({});

      await sorter.getSloMetricSignals('prom-a');
      await sorter.getSloMetricSignals('prom-b');

      expect(mockFetchSloMetricSignals).toHaveBeenNthCalledWith(1, 'prom-a', expect.any(Function));
      expect(mockFetchSloMetricSignals).toHaveBeenNthCalledWith(2, 'prom-b', expect.any(Function));
    });
  });

  describe('sortMetricsWithRecentFirst', () => {
    it('should return empty array when input is empty', () => {
      // Add some recent metrics
      addRecentMetric('metric_a');
      addRecentMetric('metric_b');

      // Test with empty metrics array
      const result = sortMetricsWithRecentFirst([]);

      // Should return empty array
      expect(result).toEqual([]);
    });

    it('should sort alphabetically when no recent metrics', () => {
      const metrics = ['b', 'c', 'a'];
      const result = sortMetricsWithRecentFirst(metrics);

      // Should be sorted alphabetically
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should prioritize recent metrics in order of recency', () => {
      // Add recent metrics in specific order
      // Note: addRecentMetric adds items to the beginning of the array,
      // so the last one added is the most recent
      addRecentMetric('a');
      addRecentMetric('c'); // Most recent

      const metrics = ['b', 'c', 'a'];
      const result = sortMetricsWithRecentFirst(metrics);

      // Recent metrics should come first in order of recency (most recent first)
      expect(result).toEqual(['c', 'a', 'b']);
    });

    it('should only include recent metrics that exist in the input', () => {
      // Add recent metrics including some not in our test array
      // Order is important - last one added is most recent
      addRecentMetric('a');
      addRecentMetric('y'); // Not in input
      addRecentMetric('c');
      addRecentMetric('z'); // Not in input

      const metrics = ['b', 'c', 'a'];
      const result = sortMetricsWithRecentFirst(metrics);

      // Only recent metrics that are in the input should appear first
      // Order by recency: z (not in input), c, y (not in input), a
      // So expected order is: c, a, b
      expect(result).toEqual(['c', 'a', 'b']);
    });

    it('should maintain order of recent metrics based on their recency', () => {
      // Add recent metrics in a specific order - MOST RECENT LAST
      addRecentMetric('z');
      addRecentMetric('a');
      addRecentMetric('c'); // Most recent

      const metrics = ['x', 'y', 'z', 'a', 'b', 'c'];
      const result = sortMetricsWithRecentFirst(metrics);

      // Recent metrics should appear in order of recency (most recent first)
      expect(result).toEqual(['c', 'a', 'z', 'b', 'x', 'y']);
    });

    it('should respect the order in which metrics were added as recent', () => {
      // Add metrics in reverse alphabetical order to ensure order is by recency, not alphabet
      // In the result, they'll appear in opposite order (most recent first)
      addRecentMetric('c'); // Least recent
      addRecentMetric('b');
      addRecentMetric('a'); // Most recent

      const metrics = ['a', 'b', 'c', 'd'];
      const result = sortMetricsWithRecentFirst(metrics);

      // Should be in order of recency (most recent first)
      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('getRecentMetrics', () => {
    it('should return an empty array when no recent metrics exist', () => {
      const result = getRecentMetrics();
      expect(result).toEqual([]);
    });

    it('should return recent metrics in order of recency', () => {
      // Set up sample data - order should be preserved
      const now = Date.now();
      const recentMetrics = [
        { name: 'metric_c', timestamp: now },
        { name: 'metric_a', timestamp: now - 1000 },
      ];

      userStorage.setItem(PREF_KEYS.RECENT_METRICS, recentMetrics);

      const result = getRecentMetrics();

      // Should match our mocked data
      expect(result).toEqual(recentMetrics);
    });
  });

  describe('addRecentMetric', () => {
    it('should add a metric to the recent metrics list', () => {
      addRecentMetric('test_metric');

      const recentMetrics = userStorage.getItem(PREF_KEYS.RECENT_METRICS) || [];

      // Should have added our metric
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].name).toBe('test_metric');
    });

    it('should put the most recently added metric first', () => {
      addRecentMetric('metric_1');
      addRecentMetric('metric_2');

      const recentMetrics = getRecentMetrics();

      // metric_2 should be first since it was added most recently
      expect(recentMetrics[0].name).toBe('metric_2');
      expect(recentMetrics[1].name).toBe('metric_1');
    });

    it('should update the timestamp when adding a metric that already exists', () => {
      // Setup fake timers
      jest.useFakeTimers();

      // Mock Date.now for consistent testing
      const originalDateNow = Date.now;
      let currentTime = 1000;
      Date.now = jest.fn(() => currentTime);

      try {
        // Add the same metric
        addRecentMetric('duplicate_metric');

        // Get the timestamp
        const firstTimestamp = getRecentMetrics()[0].timestamp;
        expect(firstTimestamp).toBe(1000);

        // Advance time
        currentTime = 2000;

        // Add the same metric again
        addRecentMetric('duplicate_metric');

        // Get the updated timestamp
        const recentMetrics = getRecentMetrics();
        const updatedTimestamp = recentMetrics[0].timestamp;

        // Should still only have one entry
        expect(recentMetrics).toHaveLength(1);

        // Timestamp should be updated
        expect(updatedTimestamp).toBe(2000);
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
        jest.useRealTimers();
      }
    });
  });
});
