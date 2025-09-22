import { isCounterMetric } from '../isCounterMetric';

describe('isCounterMetric(metric)', () => {
  describe('counter metrics (ending with "_count", "_total" or "_sum")', () => {
    test.each([['http_requests_count'], ['http_requests_total'], ['http_request_duration_seconds_sum']])(
      'returns true (%s)',
      (metric) => {
        expect(isCounterMetric(metric)).toBe(true);
      }
    );
  });

  describe('non-counter metrics (not ending with "_count", "_total" or "_sum")', () => {
    test.each([
      'cpu_usage_percent',
      'memory_available_bytes',
      'disk_free_ratio',
      'temperature_celsius',
      'count_requests_processed',
      'total_memory_available',
      'sum_calculation_result',
      'http_requests_counter',
      'bytes_partialtotal',
      'memory_summary',
      'counting',
    ])('returns false (%s)', (metric) => {
      expect(isCounterMetric(metric)).toBe(false);
    });
  });
});
