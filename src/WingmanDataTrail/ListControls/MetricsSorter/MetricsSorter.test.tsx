import { addRecentMetric, getRecentMetrics, sortMetricsWithRecentFirst } from './MetricsSorter';

describe('MetricsSorter', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: (() => {
        let store: Record<string, string> = {};

        return {
          getItem: jest.fn((key: string): string | null => {
            return store[key] || null;
          }),
          setItem: jest.fn((key: string, value: string): void => {
            store[key] = value;
          }),
          clear: jest.fn((): void => {
            store = {};
          }),
          removeItem: jest.fn((key: string): void => {
            delete store[key];
          }),
          getAll: (): Record<string, string> => ({ ...store }),
        };
      })(),
      writable: true,
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
      // Ensure localStorage is empty
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

      // Verify localStorage was accessed
      expect(window.localStorage.getItem).toHaveBeenCalled();
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

      window.localStorage.setItem('metrics-drilldown-recent-metrics/v1', JSON.stringify(recentMetrics));

      const result = getRecentMetrics();

      // Should match our mocked data
      expect(result).toEqual(recentMetrics);
    });
  });

  describe('addRecentMetric', () => {
    it('should add a metric to the recent metrics list', () => {
      addRecentMetric('test_metric');

      // Get the data from localStorage
      const storedData = window.localStorage.getItem('metrics-drilldown-recent-metrics/v1');
      const recentMetrics = JSON.parse(storedData || '[]');

      // Should have added our metric
      expect(recentMetrics.length).toBe(1);
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
        expect(recentMetrics.length).toBe(1);

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
