import { type DatasetContext } from './AttributeDistribution';
import { type ActiveFilter } from './attributeDistributionState';
import {
  applyFiltersToSelector,
  getHistogramValueTooltip,
  getLabelsToExclude,
  getOtelPriorityAttributes,
  getRangeQueryWindow,
  groupFiltersByFieldAndOperator,
  isHistogramWithThreshold,
  processFractionResponse,
  toCountMetricSelector,
  type PrometheusRangeQueryResult,
} from './PrometheusAttributeExplorer';

function createTestContext(from: number, to: number): DatasetContext {
  return { datasourceUid: 'ds', metricType: 'classic-histogram', query: 'my_metric', timeRange: { from, to } };
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

  it.each([['gauge'], ['counter'], ['native-histogram'], ['summary'], ['info'], ['status-updown'], ['age']] as const)(
    'excludes only __name__ for %s',
    (metricType) => {
      expect(getLabelsToExclude(metricType)).toEqual(new Set(['__name__']));
    }
  );
});

describe('isHistogramWithThreshold', () => {
  it.each([['classic-histogram'], ['native-histogram']] as const)('returns true for %s', (metricType) => {
    expect(isHistogramWithThreshold(metricType)).toBe(true);
  });

  it.each([['gauge'], ['counter'], ['summary'], ['info'], ['status-updown'], ['age']] as const)(
    'returns false for %s',
    (metricType) => {
      expect(isHistogramWithThreshold(metricType)).toBe(false);
    }
  );
});

describe('getOtelPriorityAttributes', () => {
  it('returns empty arrays when no labels match any shape', () => {
    expect(getOtelPriorityAttributes(['pod', 'namespace', 'cluster'])).toEqual({
      attributeLabels: {},
      priorityAttributes: [],
    });
  });

  it('detects an HTTP-shaped metric and returns only the fields actually present', () => {
    expect(getOtelPriorityAttributes(['http_route', 'pod', 'cluster'])).toEqual({
      attributeLabels: { http_route: 'http.route' },
      priorityAttributes: ['http_route'],
    });
  });

  it('preserves shape order, not discovery order, for multiple present HTTP fields', () => {
    expect(getOtelPriorityAttributes(['error_type', 'http_response_status_code', 'http_route'])).toEqual({
      attributeLabels: {
        error_type: 'error.type',
        http_response_status_code: 'http.response.status_code',
        http_route: 'http.route',
      },
      priorityAttributes: ['http_route', 'http_response_status_code', 'error_type'],
    });
  });

  it('detects a DB-shaped metric', () => {
    expect(getOtelPriorityAttributes(['db_operation_name', 'db_collection_name'])).toEqual({
      attributeLabels: { db_collection_name: 'db.collection.name', db_operation_name: 'db.operation.name' },
      priorityAttributes: ['db_operation_name', 'db_collection_name'],
    });
  });

  it('detects a messaging-shaped metric', () => {
    expect(getOtelPriorityAttributes(['messaging_destination_template'])).toEqual({
      attributeLabels: { messaging_destination_template: 'messaging.destination.template' },
      priorityAttributes: ['messaging_destination_template'],
    });
  });

  it('picks the first matching shape when labels span more than one shape', () => {
    // http is checked before db, so a metric matching both resolves to http only.
    expect(getOtelPriorityAttributes(['http_route', 'db_operation_name'])).toEqual({
      attributeLabels: { http_route: 'http.route' },
      priorityAttributes: ['http_route'],
    });
  });

  it('detects a shape when labels keep the literal dotted OTel spelling', () => {
    expect(getOtelPriorityAttributes(['http.route', 'pod'])).toEqual({
      attributeLabels: { 'http.route': 'http.route' },
      priorityAttributes: ['http.route'],
    });
  });

  it('matches each field independently in whichever spelling it actually uses', () => {
    expect(getOtelPriorityAttributes(['http.route', 'error_type'])).toEqual({
      attributeLabels: { 'http.route': 'http.route', error_type: 'error.type' },
      priorityAttributes: ['http.route', 'error_type'],
    });
  });
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

describe('processFractionResponse', () => {
  const noPresence: PrometheusRangeQueryResult = { result: [] };

  it('derives an absolute count from the total rate and window, and gives a single value 100% of its own label', () => {
    const fraction: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '0.25']] }] };
    const totalCount: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '40']] }] };
    expect(processFractionResponse(fraction, totalCount, noPresence, 'route', 1)).toEqual([
      { value: 'checkout', count: 10, impliedTotal: 40, percentage: 100 },
    ]);
  });

  it('converts a per-second rate into an estimated absolute count over the query window', () => {
    // A per-second rate of ~0.1333 displayed directly would look like a near-duplicate of a 13%
    // elsewhere on screen; multiplied by a real window (e.g. a 1-hour, 3600s query) it reads as an
    // actual volume instead, per increase(v[d]) being rate(v) * seconds (Prometheus's own definition).
    const fraction: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '0.1333']] }] };
    const totalCount: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '1']] }] };
    expect(processFractionResponse(fraction, totalCount, noPresence, 'route', 3600)).toEqual([
      { value: 'checkout', count: 480, impliedTotal: 3600, percentage: 100 },
    ]);
  });

  it('normalizes percentages across values by their share of the total in-range volume, not each value\'s own self-ratio', () => {
    // Both values have the identical 50% self-ratio (half of their own traffic is in range), but
    // checkout has 3x search's volume, so it should get 3x the percentage, not an equal 50/50 split:
    // that's exactly the self-ratio bug being fixed here.
    const fraction: PrometheusRangeQueryResult = {
      result: [
        { metric: { route: 'checkout' }, values: [[0, '0.5']] },
        { metric: { route: 'search' }, values: [[0, '0.5']] },
      ],
    };
    const totalCount: PrometheusRangeQueryResult = {
      result: [
        { metric: { route: 'checkout' }, values: [[0, '30']] },
        { metric: { route: 'search' }, values: [[0, '10']] },
      ],
    };
    expect(processFractionResponse(fraction, totalCount, noPresence, 'route', 1)).toEqual([
      { value: 'checkout', count: 15, impliedTotal: 30, percentage: 75 },
      { value: 'search', count: 5, impliedTotal: 10, percentage: 25 },
    ]);
  });

  it('lists a value at 0% when its fraction is zero but it has real volume, not dropping it or treating it as quiet', () => {
    const fraction: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '0']] }] };
    const totalCount: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '40']] }] };
    expect(processFractionResponse(fraction, totalCount, noPresence, 'route', 1)).toEqual([
      { value: 'checkout', count: 0, impliedTotal: 40, percentage: 0 },
    ]);
  });

  it('lists a value at 0% when it has zero total volume and no fraction sample at all', () => {
    const fraction: PrometheusRangeQueryResult = { result: [] };
    const totalCount: PrometheusRangeQueryResult = { result: [{ metric: { route: 'idle-route' }, values: [[0, '0']] }] };
    expect(processFractionResponse(fraction, totalCount, noPresence, 'route', 1)).toEqual([
      { value: 'idle-route', count: 0, impliedTotal: 0, percentage: 0 },
    ]);
  });

  it('coalesces a literal NaN fraction sample to 0 instead of letting it poison the whole label\'s percentages', () => {
    // histogram_fraction returns a present sample with value NaN for a zero-observation group, not an
    // absent series. Left uncoalesced, NaN * anything is NaN, which propagates into count and then into
    // grandTotal's sum, turning every value in the label to 0%, not just this one.
    const fraction: PrometheusRangeQueryResult = {
      result: [
        { metric: { route: 'idle-route' }, values: [[0, 'NaN']] },
        { metric: { route: 'checkout' }, values: [[0, '0.5']] },
      ],
    };
    const totalCount: PrometheusRangeQueryResult = {
      result: [
        { metric: { route: 'idle-route' }, values: [[0, '0']] },
        { metric: { route: 'checkout' }, values: [[0, '20']] },
      ],
    };
    expect(processFractionResponse(fraction, totalCount, noPresence, 'route', 1)).toEqual([
      { value: 'checkout', count: 10, impliedTotal: 20, percentage: 100 },
      { value: 'idle-route', count: 0, impliedTotal: 0, percentage: 0 },
    ]);
  });

  it('defaults count to 0 when a value has no matching total-count sample', () => {
    const fraction: PrometheusRangeQueryResult = { result: [{ metric: { route: 'checkout' }, values: [[0, '0.5']] }] };
    const totalCount: PrometheusRangeQueryResult = { result: [] };
    expect(processFractionResponse(fraction, totalCount, noPresence, 'route', 1)).toEqual([
      { value: 'checkout', count: 0, impliedTotal: 0, percentage: 0 },
    ]);
  });

  it('includes a value seen only by the presence query, at 0%, instead of omitting it entirely', () => {
    // Mirrors the counter path: count() only needs 1 raw sample to prove a series exists, cheaper than
    // rate()'s 2-sample minimum, so a value can show up here even when a narrow window gives rate()
    // nothing to work with for either the fraction or total-count query.
    const presence: PrometheusRangeQueryResult = { result: [{ metric: { route: 'sparse-route' }, values: [[0, '1']] }] };
    expect(processFractionResponse({ result: [] }, { result: [] }, presence, 'route', 1)).toEqual([
      { value: 'sparse-route', count: 0, impliedTotal: 0, percentage: 0 },
    ]);
  });

  it('sorts by percentage descending among active values, and sinks zero-volume values to the bottom regardless of percentage', () => {
    const fraction: PrometheusRangeQueryResult = {
      result: [
        { metric: { route: 'checkout' }, values: [[0, '0.1']] },
        { metric: { route: 'search' }, values: [[0, '0.9']] },
        { metric: { route: 'idle-route' }, values: [[0, '0.99']] },
      ],
    };
    const totalCount: PrometheusRangeQueryResult = {
      result: [
        { metric: { route: 'checkout' }, values: [[0, '100']] },
        { metric: { route: 'search' }, values: [[0, '100']] },
        { metric: { route: 'idle-route' }, values: [[0, '0']] },
      ],
    };
    // idle-route has the highest self-ratio (0.99) but zero volume, so it must sink to the bottom
    // rather than sort first, which is exactly the bug this whole rewrite fixes.
    expect(processFractionResponse(fraction, totalCount, noPresence, 'route', 1)).toEqual([
      { value: 'search', count: 90, impliedTotal: 100, percentage: 90 },
      { value: 'checkout', count: 10, impliedTotal: 100, percentage: 10 },
      { value: 'idle-route', count: 0, impliedTotal: 0, percentage: 0 },
    ]);
  });

  it('returns an empty array when the fraction response is undefined', () => {
    expect(processFractionResponse(undefined, undefined, undefined, 'route', 1)).toEqual([]);
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

  it('returns a "no activity" message, not the observations sentence, when impliedTotal is present but zero', () => {
    const tooltip = getHistogramValueTooltip(
      { value: 'idle-route', count: 0, impliedTotal: 0, percentage: 0 },
      { lowerSeconds: 1, upperSeconds: Number.POSITIVE_INFINITY }
    );
    expect(tooltip).toBe('No activity in this window.');
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
