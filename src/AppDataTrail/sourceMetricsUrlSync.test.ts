import { buildSourceMetricsOverride, parseCustomFunctionValues, parseMetricTypeValues } from './sourceMetricsUrlSync';

describe('parseCustomFunctionValues(raw)', () => {
  test('normalises a bare string (single-entry collapsed by the scenes URL layer)', () => {
    const result = parseCustomFunctionValues('max_over_time-desired_shards');
    expect(result).toEqual(new Map([['desired_shards', 'max_over_time']]));
  });

  test('normalises a multi-entry array', () => {
    const result = parseCustomFunctionValues(['max_over_time-desired_shards', 'min_over_time-queue_length']);
    expect(result).toEqual(
      new Map([
        ['desired_shards', 'max_over_time'],
        ['queue_length', 'min_over_time'],
      ])
    );
  });

  test('returns an empty map for undefined, empty string, or empty array', () => {
    expect(parseCustomFunctionValues(undefined)).toEqual(new Map());
    expect(parseCustomFunctionValues('')).toEqual(new Map());
    expect(parseCustomFunctionValues([])).toEqual(new Map());
  });

  test('splits on the FIRST dash so recording-rule names with colons survive intact', () => {
    const result = parseCustomFunctionValues('max_over_time-namespace:metric:rate5m');
    expect(result).toEqual(new Map([['namespace:metric:rate5m', 'max_over_time']]));
  });

  test('skips entries with no dash, a leading dash, or an empty side', () => {
    const result = parseCustomFunctionValues(['no_dash', '-leading', 'fn-', 'avg-metric']);
    expect(result).toEqual(new Map([['metric', 'avg']]));
  });

  test('last value wins when the same metric appears twice', () => {
    const result = parseCustomFunctionValues(['avg-metric', 'max-metric']);
    expect(result).toEqual(new Map([['metric', 'max']]));
  });
});

describe('parseMetricTypeValues(raw)', () => {
  test('normalises a bare string (single-entry collapsed by the scenes URL layer)', () => {
    const result = parseMetricTypeValues('counter-desired_shards');
    expect(result).toEqual(new Map([['desired_shards', 'counter']]));
  });

  test('normalises a multi-entry array', () => {
    const result = parseMetricTypeValues(['counter-desired_shards', 'gauge-queue_length']);
    expect(result).toEqual(
      new Map([
        ['desired_shards', 'counter'],
        ['queue_length', 'gauge'],
      ])
    );
  });

  test('returns an empty map for undefined, empty string, or empty array', () => {
    expect(parseMetricTypeValues(undefined)).toEqual(new Map());
    expect(parseMetricTypeValues('')).toEqual(new Map());
    expect(parseMetricTypeValues([])).toEqual(new Map());
  });

  test('splits on the FIRST dash so recording-rule names survive intact', () => {
    const result = parseMetricTypeValues('histogram-namespace:metric:rate5m');
    expect(result).toEqual(new Map([['namespace:metric:rate5m', 'histogram']]));
  });

  test('skips entries with invalid metric types', () => {
    const result = parseMetricTypeValues(['invalid-metric', 'counter-valid_metric']);
    expect(result).toEqual(new Map([['valid_metric', 'counter']]));
  });

  test('skips entries with no dash, a leading dash, or an empty metric name', () => {
    const result = parseMetricTypeValues(['no_dash', '-leading', 'counter-', 'gauge-metric']);
    expect(result).toEqual(new Map([['metric', 'gauge']]));
  });

  test('accepts all four valid KG metric types', () => {
    const result = parseMetricTypeValues([
      'counter-metric_a',
      'gauge-metric_b',
      'histogram-metric_c',
      'summary-metric_d',
    ]);
    expect(result).toEqual(
      new Map([
        ['metric_a', 'counter'],
        ['metric_b', 'gauge'],
        ['metric_c', 'histogram'],
        ['metric_d', 'summary'],
      ])
    );
  });

  test('last value wins when the same metric appears twice', () => {
    const result = parseMetricTypeValues(['counter-metric', 'gauge-metric']);
    expect(result).toEqual(new Map([['metric', 'gauge']]));
  });
});

describe('buildSourceMetricsOverride(metric, customRateInterval, customFunctionByMetric, metricTypeByMetric)', () => {
  test('returns undefined when there is no metric and no customFunction entries', () => {
    expect(buildSourceMetricsOverride(undefined, undefined, new Map())).toBeUndefined();
    // a customRateInterval with no active metric still yields nothing, since there is no key to attach it to
    expect(buildSourceMetricsOverride(undefined, '5m', new Map())).toBeUndefined();
  });

  test('synthesises the active metric with only customRateInterval (#1130 shape)', () => {
    const result = buildSourceMetricsOverride('desired_shards', '5m', new Map());
    expect(result).toEqual([{ metricName: 'desired_shards', labels: [], customRateInterval: '5m' }]);
  });

  test('synthesises a customFunction-only metric (#1131 shape)', () => {
    const result = buildSourceMetricsOverride(undefined, undefined, new Map([['desired_shards', 'max_over_time']]));
    expect(result).toEqual([{ metricName: 'desired_shards', labels: [], customFunction: 'max_over_time' }]);
  });

  test('merges customRateInterval and customFunction on the same active metric', () => {
    const result = buildSourceMetricsOverride('desired_shards', '5m', new Map([['desired_shards', 'max_over_time']]));
    expect(result).toEqual([
      { metricName: 'desired_shards', labels: [], customRateInterval: '5m', customFunction: 'max_over_time' },
    ]);
  });

  test('attaches customRateInterval only to the active metric, not to other customFunction entries', () => {
    const result = buildSourceMetricsOverride(
      'active_metric',
      '5m',
      new Map([['other_metric', 'min_over_time']])
    );
    expect(result).toEqual([
      { metricName: 'active_metric', labels: [], customRateInterval: '5m' },
      { metricName: 'other_metric', labels: [], customFunction: 'min_over_time' },
    ]);
  });

  test('does not duplicate the active metric when it also has a customFunction entry', () => {
    const result = buildSourceMetricsOverride('desired_shards', undefined, new Map([['desired_shards', 'max']]));
    expect(result).toEqual([{ metricName: 'desired_shards', labels: [], customFunction: 'max' }]);
  });

  test('synthesises a metricType-only metric (#1058 shape)', () => {
    const result = buildSourceMetricsOverride(undefined, undefined, new Map(), new Map([['desired_shards', 'counter']]));
    expect(result).toEqual([{ metricName: 'desired_shards', labels: [], metricType: 'counter' }]);
  });

  test('merges all three overrides on the same active metric', () => {
    const result = buildSourceMetricsOverride(
      'desired_shards',
      '5m',
      new Map([['desired_shards', 'max_over_time']]),
      new Map([['desired_shards', 'gauge']])
    );
    expect(result).toEqual([
      {
        metricName: 'desired_shards',
        labels: [],
        customRateInterval: '5m',
        customFunction: 'max_over_time',
        metricType: 'gauge',
      },
    ]);
  });

  test('merges multiple metrics with different override combinations', () => {
    const result = buildSourceMetricsOverride(
      'active_metric',
      '5m',
      new Map([['fn_metric', 'min_over_time']]),
      new Map([
        ['active_metric', 'counter'],
        ['type_only_metric', 'histogram'],
      ])
    );
    expect(result).toEqual([
      { metricName: 'active_metric', labels: [], customRateInterval: '5m', metricType: 'counter' },
      { metricName: 'fn_metric', labels: [], customFunction: 'min_over_time' },
      { metricName: 'type_only_metric', labels: [], metricType: 'histogram' },
    ]);
  });

  test('does not duplicate metrics that appear in both customFunction and metricType maps', () => {
    const result = buildSourceMetricsOverride(
      undefined,
      undefined,
      new Map([['metric', 'max_over_time']]),
      new Map([['metric', 'gauge']])
    );
    expect(result).toEqual([
      { metricName: 'metric', labels: [], customFunction: 'max_over_time', metricType: 'gauge' },
    ]);
  });
});
