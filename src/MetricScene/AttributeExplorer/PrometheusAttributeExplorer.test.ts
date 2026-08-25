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
  parseDefaultLowerThreshold,
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
  it('returns empty results when no labels match any shape', () => {
    expect(getOtelPriorityAttributes(['pod', 'namespace', 'cluster'])).toEqual({
      attributeKinds: {},
      attributeLabels: {},
      priorityAttributes: [],
    });
  });

  it('detects an HTTP-shaped metric and returns only the fields actually present', () => {
    expect(getOtelPriorityAttributes(['http_route', 'pod', 'cluster'])).toEqual({
      attributeKinds: { http_route: 'metric' },
      attributeLabels: { http_route: 'http.route' },
      priorityAttributes: ['http_route'],
    });
  });

  it('preserves shape order, not discovery order, for multiple present HTTP fields', () => {
    expect(getOtelPriorityAttributes(['error_type', 'http_response_status_code', 'http_route'])).toEqual({
      attributeKinds: { error_type: 'metric', http_response_status_code: 'metric', http_route: 'metric' },
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
      attributeKinds: { db_collection_name: 'metric', db_operation_name: 'metric' },
      attributeLabels: { db_collection_name: 'db.collection.name', db_operation_name: 'db.operation.name' },
      priorityAttributes: ['db_operation_name', 'db_collection_name'],
    });
  });

  it('detects a messaging-shaped metric', () => {
    expect(getOtelPriorityAttributes(['messaging_destination_template'])).toEqual({
      attributeKinds: { messaging_destination_template: 'metric' },
      attributeLabels: { messaging_destination_template: 'messaging.destination.template' },
      priorityAttributes: ['messaging_destination_template'],
    });
  });

  it('breaks a tie between domains matching exactly one field each by keeping the first-defined domain', () => {
    // http is defined before db, so a genuine one-field-each tie resolves to http.
    expect(getOtelPriorityAttributes(['http_route', 'db_operation_name'])).toEqual({
      attributeKinds: { http_route: 'metric' },
      attributeLabels: { http_route: 'http.route' },
      priorityAttributes: ['http_route'],
    });
  });

  it('picks the domain with the most matching fields, not the first domain with any match at all', () => {
    // error.type is shared by http and database, so an any-match rule would resolve this to http (the
    // first domain checked) on error_type alone and never even look at database's second, unambiguous
    // field. Database has two matches (error_type, db_operation_name) to http's one, so it must win.
    expect(getOtelPriorityAttributes(['error_type', 'db_operation_name'])).toEqual({
      attributeKinds: { error_type: 'metric', db_operation_name: 'metric' },
      attributeLabels: { error_type: 'error.type', db_operation_name: 'db.operation.name' },
      priorityAttributes: ['db_operation_name', 'error_type'],
    });
  });

  it('detects a shape when labels keep the literal dotted OTel spelling', () => {
    expect(getOtelPriorityAttributes(['http.route', 'pod'])).toEqual({
      attributeKinds: { 'http.route': 'metric' },
      attributeLabels: { 'http.route': 'http.route' },
      priorityAttributes: ['http.route'],
    });
  });

  it('matches each field independently in whichever spelling it actually uses', () => {
    expect(getOtelPriorityAttributes(['http.route', 'error_type'])).toEqual({
      attributeKinds: { 'http.route': 'metric', error_type: 'metric' },
      attributeLabels: { 'http.route': 'http.route', error_type: 'error.type' },
      priorityAttributes: ['http.route', 'error_type'],
    });
  });

  it('detects an RPC-shaped metric', () => {
    expect(getOtelPriorityAttributes(['rpc_system_name', 'rpc_method'])).toEqual({
      attributeKinds: { rpc_system_name: 'metric', rpc_method: 'metric' },
      attributeLabels: { rpc_system_name: 'rpc.system.name', rpc_method: 'rpc.method' },
      priorityAttributes: ['rpc_system_name', 'rpc_method'],
    });
  });

  it('detects a GenAI-shaped metric', () => {
    expect(getOtelPriorityAttributes(['gen_ai_operation_name', 'gen_ai_provider_name'])).toEqual({
      attributeKinds: { gen_ai_operation_name: 'metric', gen_ai_provider_name: 'metric' },
      attributeLabels: { gen_ai_operation_name: 'gen_ai.operation.name', gen_ai_provider_name: 'gen_ai.provider.name' },
      priorityAttributes: ['gen_ai_operation_name', 'gen_ai_provider_name'],
    });
  });

  it('includes every present resource attribute, not just the first, since a metric can carry many at once', () => {
    expect(getOtelPriorityAttributes(['service_name', 'k8s_pod_name', 'cloud_region'])).toEqual({
      attributeKinds: { service_name: 'resource', k8s_pod_name: 'resource', cloud_region: 'resource' },
      attributeLabels: { service_name: 'service.name', k8s_pod_name: 'k8s.pod.name', cloud_region: 'cloud.region' },
      priorityAttributes: ['service_name', 'k8s_pod_name', 'cloud_region'],
    });
  });

  it('detects resource attributes even when no histogram domain shape matches at all', () => {
    // A custom, non-semantic-convention histogram can still have resource attributes promoted onto it.
    expect(getOtelPriorityAttributes(['service_name', 'custom_field'])).toEqual({
      attributeKinds: { service_name: 'resource' },
      attributeLabels: { service_name: 'service.name' },
      priorityAttributes: ['service_name'],
    });
  });

  it('lists domain-matched attributes before resource attributes, not interleaved, and tags each with its actual kind', () => {
    expect(getOtelPriorityAttributes(['service_name', 'http_route', 'k8s_pod_name'])).toEqual({
      attributeKinds: { http_route: 'metric', service_name: 'resource', k8s_pod_name: 'resource' },
      attributeLabels: { http_route: 'http.route', service_name: 'service.name', k8s_pod_name: 'k8s.pod.name' },
      priorityAttributes: ['http_route', 'service_name', 'k8s_pod_name'],
    });
  });

  it('does not cap or discard matches for a richly-instrumented metric: bounding concurrent queries is AttributeDistribution\'s job (maxPriorityAndPinned), not detection\'s', () => {
    // 4 domain matches + 4 resource matches = 8 candidates, all of which must survive detection intact
    // so they still sort ahead of ordinary labels and still get an accurate badge, even though only the
    // first few are eagerly fetched (bounded downstream by AttributeDistribution's maxPriorityAndPinned).
    const labels = [
      'http_request_method',
      'url_scheme',
      'http_route',
      'http_response_status_code',
      'service_name',
      'service_instance_id',
      'service_namespace',
      'deployment_environment_name',
    ];
    const result = getOtelPriorityAttributes(labels);
    expect(result.priorityAttributes).toEqual([
      'http_request_method',
      'url_scheme',
      'http_route',
      'http_response_status_code',
      'service_name',
      'service_instance_id',
      'service_namespace',
      'deployment_environment_name',
    ]);
    expect(result.attributeLabels).toHaveProperty('service_namespace', 'service.namespace');
    expect(result.attributeKinds).toHaveProperty('service_namespace', 'resource');
    expect(result.attributeLabels).toHaveProperty('deployment_environment_name', 'deployment.environment.name');
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
    // Double-escaped, not single: escapePromQLRegex's own backslash must itself survive the outer
    // PromQL string literal (which unescapes \\ back down to one \ before the regex engine ever sees
    // it), so each metacharacter's regex-escaping backslash needs a second, string-level backslash on
    // top of it.
    const filters: ActiveFilter[] = [
      { field: 'path', operator: '=', value: '/a.b' },
      { field: 'path', operator: '=', value: '/c(d)' },
    ];
    expect(applyFiltersToSelector('my_metric{}', filters)).toBe('my_metric{path=~"^(/a\\\\.b|/c\\\\(d\\\\))$"}');
  });

  it('escapes a literal quote in a multi-value filter, preventing it from breaking out of the string literal', () => {
    const filters: ActiveFilter[] = [
      { field: 'query', operator: '=', value: 'a"b' },
      { field: 'query', operator: '=', value: 'c' },
    ];
    expect(applyFiltersToSelector('my_metric{}', filters)).toBe('my_metric{query=~"^(a\\"b|c)$"}');
  });

  it('escapes a literal backslash in a multi-value filter so it reaches the regex engine as one escaped backslash, not a stray one', () => {
    const filters: ActiveFilter[] = [
      { field: 'query', operator: '=', value: 'a\\b' },
      { field: 'query', operator: '=', value: 'c' },
    ];
    expect(applyFiltersToSelector('my_metric{}', filters)).toBe('my_metric{query=~"^(a\\\\\\\\b|c)$"}');
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
    expect(
      getHistogramValueTooltip(
        { value: 'api', count: 5, percentage: 10 },
        { lowerSeconds: 1, upperSeconds: Number.POSITIVE_INFINITY },
        'seconds'
      )
    ).toBeUndefined();
  });

  it('includes the count, percentage, and implied total when impliedTotal is present', () => {
    const tooltip = getHistogramValueTooltip(
      { value: 'api', count: 1440, impliedTotal: 14400, percentage: 10 },
      { lowerSeconds: 1, upperSeconds: Number.POSITIVE_INFINITY },
      'seconds'
    );
    expect(tooltip).toContain('1440');
    expect(tooltip).toContain('10');
    expect(tooltip).toContain('14400');
  });

  it('labels the range with the metric\'s actual unit, not a hardcoded seconds suffix', () => {
    const tooltip = getHistogramValueTooltip(
      { value: 'api', count: 5, impliedTotal: 40, percentage: 12 },
      { lowerSeconds: 2, upperSeconds: Number.POSITIVE_INFINITY },
      'bytes'
    );
    expect(tooltip).toContain('2 bytes');
    expect(tooltip).not.toContain('2s');
  });

  it('falls back to a bare number with no unit word when the unit is unknown', () => {
    const tooltip = getHistogramValueTooltip(
      { value: 'api', count: 5, impliedTotal: 40, percentage: 12 },
      { lowerSeconds: 2, upperSeconds: Number.POSITIVE_INFINITY },
      null
    );
    // "over 2 (" not "over 2 seconds (" or similar: confirms no unit word snuck in when unit is unknown.
    expect(tooltip).toContain('over 2 (');
  });

  it('returns a "no activity" message, not the observations sentence, when impliedTotal is present but zero', () => {
    const tooltip = getHistogramValueTooltip(
      { value: 'idle-route', count: 0, impliedTotal: 0, percentage: 0 },
      { lowerSeconds: 1, upperSeconds: Number.POSITIVE_INFINITY },
      'seconds'
    );
    expect(tooltip).toBe('No activity in this window.');
  });
});

describe('parseDefaultLowerThreshold', () => {
  it('returns the last sample value, e.g. a sub-millisecond median for a fast metric', () => {
    const response: PrometheusRangeQueryResult = { result: [{ metric: {}, values: [[0, '0.00023']] }] };
    expect(parseDefaultLowerThreshold(response)).toBeCloseTo(0.00023, 5);
  });

  it('takes the last sample, not the first, when the series has multiple points', () => {
    const response: PrometheusRangeQueryResult = {
      result: [
        {
          metric: {},
          values: [
            [0, '10'],
            [60, '2.5'],
          ],
        },
      ],
    };
    expect(parseDefaultLowerThreshold(response)).toBe(2.5);
  });

  it('returns undefined when the response is undefined', () => {
    expect(parseDefaultLowerThreshold(undefined)).toBeUndefined();
  });

  it('returns undefined when result is empty, e.g. the metric has no traffic in this window', () => {
    expect(parseDefaultLowerThreshold({ result: [] })).toBeUndefined();
  });

  // 0 would produce a threshold that excludes nothing; a negative value is something histogram_quantile
  // can return for a malformed bucket set; NaN is a non-finite sample. All three are equally unusable
  // as a starting threshold.
  it.each([['0'], ['-1'], ['NaN']])('returns undefined for a non-positive-finite sample (%s)', (sampleValue) => {
    const response: PrometheusRangeQueryResult = { result: [{ metric: {}, values: [[0, sampleValue]] }] };
    expect(parseDefaultLowerThreshold(response)).toBeUndefined();
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
