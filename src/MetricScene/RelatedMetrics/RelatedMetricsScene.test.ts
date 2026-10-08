import { getRelatedMetricsCount } from './RelatedMetricsScene';

describe('getRelatedMetricsCount', () => {
  it('does not expose a count while the metrics request is loading', () => {
    expect(getRelatedMetricsCount(true, [{ value: 'metric_a' }])).toBeUndefined();
  });

  it('reports the number of metrics returned by the data source after loading', () => {
    expect(getRelatedMetricsCount(false, [{ value: 'metric_a' }, { value: 'metric_b' }])).toBe(2);
  });

  it('reports the filtered option count rather than the unfiltered count', () => {
    expect(getRelatedMetricsCount(false, [{ value: 'metric_a' }])).toBe(1);
  });

  it('does not infer a larger total when the data source returns its limit', () => {
    const returnedOptions = Array.from({ length: 10_000 }, (_, index) => ({ value: `metric_${index}` }));

    expect(getRelatedMetricsCount(false, returnedOptions)).toBe(10_000);
  });
});
