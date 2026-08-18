import { getMetricUnit } from '../getMetricUnit';

describe('getMetricUnit', () => {
  it('extracts seconds from a classic histogram bucket series', () => {
    expect(getMetricUnit('adaptive_logs_api_request_duration_seconds_bucket')).toBe('seconds');
  });

  it('extracts bytes from a classic histogram bucket series', () => {
    expect(getMetricUnit('http_response_size_bytes_bucket')).toBe('bytes');
  });

  it('extracts ratio from a classic histogram bucket series', () => {
    expect(getMetricUnit('cache_hit_ratio_bucket')).toBe('ratio');
  });

  it('extracts the unit from a _sum sibling series', () => {
    expect(getMetricUnit('http_request_duration_seconds_sum')).toBe('seconds');
  });

  it('extracts the unit from a _count sibling series', () => {
    expect(getMetricUnit('http_request_duration_seconds_count')).toBe('seconds');
  });

  it('extracts the unit from a bare metric name with no histogram-family suffix', () => {
    expect(getMetricUnit('http_request_duration_seconds')).toBe('seconds');
  });

  it('returns undefined when the metric name has no recognized unit suffix', () => {
    expect(getMetricUnit('my_custom_metric_bucket')).toBeUndefined();
  });

  it('returns undefined for a metric name with no suffix at all', () => {
    expect(getMetricUnit('up')).toBeUndefined();
  });

  it('only strips one histogram-family suffix, not a unit that coincidentally matches one', () => {
    // A metric literally named "..._count_bucket" should still resolve off the base after stripping
    // only the trailing _bucket, not both suffixes.
    expect(getMetricUnit('widgets_processed_count_bucket')).toBeUndefined();
  });
});
