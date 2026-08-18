import { type DatasetContext } from './AttributeDistribution';
import { type ActiveFilter } from './attributeDistributionState';
import {
  applyFiltersToSelector,
  getHistogramValueTooltip,
  getLabelsToExclude,
  getRangeQueryWindow,
  groupFiltersByFieldAndOperator,
  mergePresenceAndWeights,
  processDistributionResponse,
  processFractionResponse,
  toCountMetricSelector,
  type PrometheusRangeQueryResult,
} from './PrometheusAttributeExplorer';

function createTestContext(from: number, to: number): DatasetContext {
  return { datasourceUid: 'ds', metricType: 'gauge', query: 'my_metric', timeRange: { from, to } };
}

describe('getLabelsToExclude', () => {
  it('always excludes __name__', () => {
    expect(getLabelsToExclude('gauge').has('__name__')).toBe(true);
  });

  it('excludes le and asserts_metric_latency for classic-histogram, in addition to __name__', () => {
    // asserts_metric_latency is Asserts-injected structural metadata, not a real dimension: confirmed
    // live its value differs between a metric family's _bucket and _count sibling series.
    expect(getLabelsToExclude('classic-histogram')).toEqual(new Set(['__name__', 'le', 'asserts_metric_latency']));
  });

  it('excludes quantile for summary, in addition to __name__', () => {
    expect(getLabelsToExclude('summary')).toEqual(new Set(['__name__', 'quantile']));
  });

  it.each([['gauge'], ['counter'], ['native-histogram'], ['info'], ['status-updown'], ['age']] as const)(
    'excludes only __name__ for %s',
    (metricType) => {
      expect(getLabelsToExclude(metricType)).toEqual(new Set(['__name__']));
    }
  );
});

describe('groupFiltersByFieldAndOperator', () => {
  it('returns one group per field when there is a single value', () => {
    const filters: ActiveFilter[] = [{ field: 'job', operator: '=', value: 'api' }];
    expect(groupFiltersByFieldAndOperator(filters)).toEqual([{ field: 'job', operator: '=', values: ['api'] }]);
  });

  it('groups multiple values for the same field and operator together', () => {
    const filters: ActiveFilter[] = [
      { field: 'job', operator: '=', value: 'api' },
      { field: 'job', operator: '=', value: 'worker' },
    ];
    expect(groupFiltersByFieldAndOperator(filters)).toEqual([
      { field: 'job', operator: '=', values: ['api', 'worker'] },
    ]);
  });

  it('keeps different operators on the same field in separate groups', () => {
    const filters: ActiveFilter[] = [
      { field: 'job', operator: '=', value: 'api' },
      { field: 'job', operator: '!=', value: 'worker' },
    ];
    expect(groupFiltersByFieldAndOperator(filters)).toEqual([
      { field: 'job', operator: '=', values: ['api'] },
      { field: 'job', operator: '!=', values: ['worker'] },
    ]);
  });

  it('keeps different fields in separate groups', () => {
    const filters: ActiveFilter[] = [
      { field: 'job', operator: '=', value: 'api' },
      { field: 'instance', operator: '=', value: 'host-1' },
    ];
    expect(groupFiltersByFieldAndOperator(filters)).toEqual([
      { field: 'job', operator: '=', values: ['api'] },
      { field: 'instance', operator: '=', values: ['host-1'] },
    ]);
  });

  it('returns an empty array for an empty input', () => {
    expect(groupFiltersByFieldAndOperator([])).toEqual([]);
  });
});

describe('applyFiltersToSelector', () => {
  it('returns the selector unchanged when there are no filters', () => {
    expect(applyFiltersToSelector('my_metric{__ignore_usage__=""}', [])).toBe('my_metric{__ignore_usage__=""}');
  });

  it('appends a single-value filter as a plain equality matcher', () => {
    const filters: ActiveFilter[] = [{ field: 'job', operator: '=', value: 'api' }];
    expect(applyFiltersToSelector('my_metric{__ignore_usage__=""}', filters)).toBe(
      'my_metric{__ignore_usage__="", job="api"}'
    );
  });

  it('appends a single-value exclude filter with !=', () => {
    const filters: ActiveFilter[] = [{ field: 'job', operator: '!=', value: 'api' }];
    expect(applyFiltersToSelector('my_metric{__ignore_usage__=""}', filters)).toBe(
      'my_metric{__ignore_usage__="", job!="api"}'
    );
  });

  it('collapses multiple values for the same field into a single =~ regex alternation, not ANDed = matchers', () => {
    // Two separate = matchers on the same label would AND together and match nothing.
    const filters: ActiveFilter[] = [
      { field: 'job', operator: '=', value: 'api' },
      { field: 'job', operator: '=', value: 'worker' },
    ];
    expect(applyFiltersToSelector('my_metric{}', filters)).toBe('my_metric{job=~"^(api|worker)$"}');
  });

  it('collapses multiple excluded values into a single !~ regex alternation', () => {
    const filters: ActiveFilter[] = [
      { field: 'job', operator: '!=', value: 'api' },
      { field: 'job', operator: '!=', value: 'worker' },
    ];
    expect(applyFiltersToSelector('my_metric{}', filters)).toBe('my_metric{job!~"^(api|worker)$"}');
  });

  it('escapes regex metacharacters in multi-value alternations', () => {
    const filters: ActiveFilter[] = [
      { field: 'path', operator: '=', value: '/a.b' },
      { field: 'path', operator: '=', value: '/c(d)' },
    ];
    expect(applyFiltersToSelector('my_metric{}', filters)).toBe('my_metric{path=~"^(/a\\.b|/c\\(d\\))$"}');
  });

  it('strips a dangling trailing comma left by an empty ${filters:raw} interpolation before joining', () => {
    const filters: ActiveFilter[] = [{ field: 'cluster', operator: '=', value: 'dev-us-east-0' }];
    expect(applyFiltersToSelector('adaptive_logs_gateway_archival_write_duration_seconds{__ignore_usage__="", }', filters)).toBe(
      'adaptive_logs_gateway_archival_write_duration_seconds{__ignore_usage__="", cluster="dev-us-east-0"}'
    );
  });

  it('strips a dangling trailing comma even with no other existing content', () => {
    const filters: ActiveFilter[] = [{ field: 'job', operator: '=', value: 'api' }];
    expect(applyFiltersToSelector('my_metric{, }', filters)).toBe('my_metric{job="api"}');
  });

  it('escapes quotes and backslashes in single-value matchers', () => {
    const filters: ActiveFilter[] = [{ field: 'msg', operator: '=', value: 'a"b\\c' }];
    expect(applyFiltersToSelector('my_metric{}', filters)).toBe('my_metric{msg="a\\"b\\\\c"}');
  });

  it('handles a bare selector with no braces at all', () => {
    const filters: ActiveFilter[] = [{ field: 'job', operator: '=', value: 'api' }];
    expect(applyFiltersToSelector('my_metric', filters)).toBe('my_metric{job="api"}');
  });

  it('combines a single-value and a multi-value filter on different fields', () => {
    const filters: ActiveFilter[] = [
      { field: 'env', operator: '=', value: 'prod' },
      { field: 'job', operator: '=', value: 'api' },
      { field: 'job', operator: '=', value: 'worker' },
    ];
    expect(applyFiltersToSelector('my_metric{}', filters)).toBe(
      'my_metric{env="prod", job=~"^(api|worker)$"}'
    );
  });
});

describe('processDistributionResponse', () => {
  it('returns an empty array when the response is undefined', () => {
    expect(processDistributionResponse(undefined, 'job')).toEqual([]);
  });

  it('returns an empty array when result is empty', () => {
    expect(processDistributionResponse({ result: [] }, 'job')).toEqual([]);
  });

  it('computes rounded percentages and sorts by percentage descending', () => {
    const response: PrometheusRangeQueryResult = {
      result: [
        { metric: { job: 'api' }, values: [[0, '1']] },
        { metric: { job: 'worker' }, values: [[0, '3']] },
      ],
    };
    expect(processDistributionResponse(response, 'job')).toEqual([
      { value: 'worker', count: 3, percentage: 75 },
      { value: 'api', count: 1, percentage: 25 },
    ]);
  });

  it('takes the last sample of each series, not the first, when a series has multiple points', () => {
    const response: PrometheusRangeQueryResult = {
      result: [
        {
          metric: { job: 'api' },
          values: [
            [0, '10'],
            [60, '2'],
          ],
        },
      ],
    };
    expect(processDistributionResponse(response, 'job')).toEqual([{ value: 'api', count: 2, percentage: 100 }]);
  });

  it('skips series where the label is absent from the metric labelset', () => {
    const response: PrometheusRangeQueryResult = {
      result: [
        { metric: {}, values: [[0, '5']] },
        { metric: { job: 'api' }, values: [[0, '5']] },
      ],
    };
    expect(processDistributionResponse(response, 'job')).toEqual([{ value: 'api', count: 5, percentage: 100 }]);
  });

  it('skips series with a zero or non-numeric count', () => {
    const response: PrometheusRangeQueryResult = {
      result: [
        { metric: { job: 'zero' }, values: [[0, '0']] },
        { metric: { job: 'nan' }, values: [[0, 'NaN']] },
        { metric: { job: 'api' }, values: [[0, '2']] },
      ],
    };
    expect(processDistributionResponse(response, 'job')).toEqual([{ value: 'api', count: 2, percentage: 100 }]);
  });
});

describe('mergePresenceAndWeights', () => {
  it('lists a present value at 0% when its weight is zero, instead of dropping it', () => {
    const presence: PrometheusRangeQueryResult = { result: [{ metric: { job: 'api' }, values: [[0, '1']] }] };
    const weights: PrometheusRangeQueryResult = { result: [{ metric: { job: 'api' }, values: [[0, '0']] }] };
    expect(mergePresenceAndWeights(presence, weights, 'job', 1)).toEqual([{ value: 'api', count: 0, percentage: 0 }]);
  });

  it('lists a present value at 0% when it has no weight sample at all', () => {
    const presence: PrometheusRangeQueryResult = { result: [{ metric: { job: 'idle' }, values: [[0, '1']] }] };
    const weights: PrometheusRangeQueryResult = { result: [] };
    expect(mergePresenceAndWeights(presence, weights, 'job', 1)).toEqual([{ value: 'idle', count: 0, percentage: 0 }]);
  });

  it('weights present values by their rate and sorts by percentage descending', () => {
    const presence: PrometheusRangeQueryResult = {
      result: [
        { metric: { job: 'api' }, values: [[0, '1']] },
        { metric: { job: 'worker' }, values: [[0, '1']] },
      ],
    };
    const weights: PrometheusRangeQueryResult = {
      result: [
        { metric: { job: 'api' }, values: [[0, '1']] },
        { metric: { job: 'worker' }, values: [[0, '3']] },
      ],
    };
    expect(mergePresenceAndWeights(presence, weights, 'job', 1)).toEqual([
      { value: 'worker', count: 3, percentage: 75 },
      { value: 'api', count: 1, percentage: 25 },
    ]);
  });

  it('treats a value found only in weights as present too, not just values the presence query saw', () => {
    // The bare-selector presence query only sees a series scraped within the default 5m staleness
    // window at one of the 1-2 instants a single-step range query evaluates; a value the rate
    // query itself found is proof enough that the series exists, even if presence missed it.
    const presence: PrometheusRangeQueryResult = { result: [{ metric: { job: 'api' }, values: [[0, '1']] }] };
    const weights: PrometheusRangeQueryResult = {
      result: [
        { metric: { job: 'api' }, values: [[0, '1']] },
        { metric: { job: 'ghost' }, values: [[0, '99']] },
      ],
    };
    expect(mergePresenceAndWeights(presence, weights, 'job', 1)).toEqual([
      { value: 'ghost', count: 99, percentage: 99 },
      { value: 'api', count: 1, percentage: 1 },
    ]);
  });

  it('converts a per-second rate into an estimated absolute count over the query window', () => {
    // A per-second rate of ~0.1333 displayed directly would look like a near-duplicate of a 13%
    // elsewhere on screen; multiplied by a real window (e.g. a 1-hour, 3600s query) it reads as an
    // actual volume instead, per increase(v[d]) being rate(v) * seconds (Prometheus's own definition).
    const presence: PrometheusRangeQueryResult = { result: [{ metric: { job: 'api' }, values: [[0, '1']] }] };
    const weights: PrometheusRangeQueryResult = { result: [{ metric: { job: 'api' }, values: [[0, '0.1333']] }] };
    expect(mergePresenceAndWeights(presence, weights, 'job', 3600)).toEqual([
      { value: 'api', count: 480, percentage: 100 },
    ]);
  });

  it('returns an empty array when nothing is present', () => {
    expect(mergePresenceAndWeights({ result: [] }, { result: [] }, 'job', 1)).toEqual([]);
  });
});

describe('processFractionResponse', () => {
  it('converts a fraction to a percentage and derives an absolute count from the total rate and window', () => {
    const fraction: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '0.25']] }] };
    const totalCount: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '40']] }] };
    expect(processFractionResponse(fraction, totalCount, 'route', 1)).toEqual([
      { value: 'checkout', count: 10, impliedTotal: 40, percentage: 25 },
    ]);
  });

  it('converts a per-second rate into an estimated absolute count over the query window', () => {
    // A per-second rate of ~0.1333 displayed directly would look like a near-duplicate of a 13%
    // elsewhere on screen; multiplied by a real window (e.g. a 1-hour, 3600s query) it reads as an
    // actual volume instead, per increase(v[d]) being rate(v) * seconds (Prometheus's own definition).
    const fraction: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '0.1333']] }] };
    const totalCount: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '1']] }] };
    expect(processFractionResponse(fraction, totalCount, 'route', 3600)).toEqual([
      { value: 'checkout', count: 480, impliedTotal: 3600, percentage: 13 },
    ]);
  });

  it('does not normalize percentages across values: each is independent, not a split of a whole', () => {
    const fraction: PrometheusRangeQueryResult = {
      result: [
        { metric: { route: 'checkout' }, values: [[0, '0.5']] },
        { metric: { route: 'search' }, values: [[0, '0.5']] },
      ],
    };
    const totalCount: PrometheusRangeQueryResult = {
      result: [
        { metric: { route: 'checkout' }, values: [[0, '10']] },
        { metric: { route: 'search' }, values: [[0, '10']] },
      ],
    };
    expect(processFractionResponse(fraction, totalCount, 'route', 1)).toEqual([
      { value: 'checkout', count: 5, impliedTotal: 10, percentage: 50 },
      { value: 'search', count: 5, impliedTotal: 10, percentage: 50 },
    ]);
  });

  it('lists a value at 0% when its fraction is zero, not dropping it', () => {
    const fraction: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '0']] }] };
    const totalCount: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '40']] }] };
    expect(processFractionResponse(fraction, totalCount, 'route', 1)).toEqual([
      { value: 'checkout', count: 0, impliedTotal: 40, percentage: 0 },
    ]);
  });

  it('lists a value at 0% when it has zero total volume and histogram_fraction omits it as NaN', () => {
    // histogram_fraction returns NaN for a zero-observation group, and extractLastSampleByValue drops
    // NaN samples, so a genuinely-idle label would be entirely absent from the fraction map. Presence
    // must come from the union of both queries' keys, not just the fraction query's, per issue #1029's
    // own edge-case requirement: "Show 0% bar for missing values, don't hide."
    const fraction: PrometheusRangeQueryResult = { result: [] };
    const totalCount: PrometheusRangeQueryResult = { result: [{ metric: { route: 'idle-route' }, values: [[0, '0']] }] };
    expect(processFractionResponse(fraction, totalCount, 'route', 1)).toEqual([
      { value: 'idle-route', count: 0, impliedTotal: 0, percentage: 0 },
    ]);
  });

  it('defaults count to 0 when a value has no matching total-count sample', () => {
    const fraction: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '0.5']] }] };
    const totalCount: PrometheusRangeQueryResult = { result: [] };
    expect(processFractionResponse(fraction, totalCount, 'route', 1)).toEqual([
      { value: 'checkout', count: 0, impliedTotal: 0, percentage: 50 },
    ]);
  });

  it('sorts by percentage descending', () => {
    const fraction: PrometheusRangeQueryResult = {
      result: [
        { metric: { route: 'checkout' }, values: [[0, '0.1']] },
        { metric: { route: 'search' }, values: [[0, '0.9']] },
      ],
    };
    expect(processFractionResponse(fraction, { result: [] }, 'route', 1)).toEqual([
      { value: 'search', count: 0, impliedTotal: 0, percentage: 90 },
      { value: 'checkout', count: 0, impliedTotal: 0, percentage: 10 },
    ]);
  });

  it('returns an empty array when the fraction response is undefined', () => {
    expect(processFractionResponse(undefined, undefined, 'route', 1)).toEqual([]);
  });
});

describe('getHistogramValueTooltip', () => {
  it('returns undefined when the item has no impliedTotal, since there is nothing extra to say', () => {
    expect(getHistogramValueTooltip({ value: 'api', count: 5, percentage: 10 }, { lowerSeconds: 1, upperSeconds: Number.POSITIVE_INFINITY })).toBeUndefined();
  });

  it('includes the count, percentage, and implied total when impliedTotal is present', () => {
    const tooltip = getHistogramValueTooltip(
      { value: 'api', count: 1440, impliedTotal: 14400, percentage: 10 },
      { lowerSeconds: 1, upperSeconds: Number.POSITIVE_INFINITY }
    );
    expect(tooltip).toContain('1440');
    expect(tooltip).toContain('10');
    expect(tooltip).toContain('14400');
  });
});

describe('toCountMetricSelector', () => {
  it('swaps a trailing _bucket for _count, keeping the label matchers', () => {
    expect(toCountMetricSelector('my_metric_bucket{__ignore_usage__="", job="api"}')).toBe(
      'my_metric_count{__ignore_usage__="", job="api"}'
    );
  });

  it('swaps _bucket for _count on a bare selector with no braces', () => {
    expect(toCountMetricSelector('my_metric_bucket')).toBe('my_metric_count');
  });

  it('only replaces a trailing _bucket, not one appearing earlier in the metric name', () => {
    expect(toCountMetricSelector('bucket_fill_rate_bucket{}')).toBe('bucket_fill_rate_count{}');
  });
});

describe('getRangeQueryWindow', () => {
  it('uses the full selected range as the step, not a small per-point interval', () => {
    const window = getRangeQueryWindow(createTestContext(0, 3_600_000));
    expect(window).toEqual({ startSeconds: 0, endSeconds: 3600, stepSeconds: 3600 });
  });

  it('clamps step to 1s for a zero-width range, instead of producing an invalid rate(...[0s])', () => {
    const window = getRangeQueryWindow(createTestContext(1_700_000_000_000, 1_700_000_000_000));
    expect(window.stepSeconds).toBe(1);
  });

  it('clamps step to 1s for an inverted range, instead of producing an invalid negative duration', () => {
    // A corrupted or misconfigured time range where "to" precedes "from" should never reach Prometheus
    // as a negative-duration range vector like rate(...[-5s]), which is not valid PromQL.
    const window = getRangeQueryWindow(createTestContext(10_000, 5_000));
    expect(window.stepSeconds).toBe(1);
  });

  it('floors sub-second timestamps to whole seconds for both bounds and the resulting step', () => {
    const window = getRangeQueryWindow(createTestContext(1_500, 2_500));
    expect(window).toEqual({ startSeconds: 1, endSeconds: 2, stepSeconds: 1 });
  });

  it('produces a correctly scaled step for a much larger range, with no overflow', () => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const window = getRangeQueryWindow(createTestContext(0, thirtyDaysMs));
    expect(window).toEqual({ startSeconds: 0, endSeconds: 2_592_000, stepSeconds: 2_592_000 });
  });
});
