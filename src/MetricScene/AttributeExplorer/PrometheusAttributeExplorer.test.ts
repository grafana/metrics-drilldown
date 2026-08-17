import { type ActiveFilter } from './attributeDistributionState';
import {
  applyFiltersToSelector,
  groupFiltersByFieldAndOperator,
  mergePresenceAndWeights,
  processDistributionResponse,
  type PrometheusRangeQueryResult,
} from './PrometheusAttributeExplorer';

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
    expect(mergePresenceAndWeights(presence, weights, 'job')).toEqual([{ value: 'api', count: 0, percentage: 0 }]);
  });

  it('lists a present value at 0% when it has no weight sample at all', () => {
    const presence: PrometheusRangeQueryResult = { result: [{ metric: { job: 'idle' }, values: [[0, '1']] }] };
    const weights: PrometheusRangeQueryResult = { result: [] };
    expect(mergePresenceAndWeights(presence, weights, 'job')).toEqual([{ value: 'idle', count: 0, percentage: 0 }]);
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
    expect(mergePresenceAndWeights(presence, weights, 'job')).toEqual([
      { value: 'worker', count: 3, percentage: 75 },
      { value: 'api', count: 1, percentage: 25 },
    ]);
  });

  it('treats a value found only in weights as present too, not just values the presence query saw', () => {
    // The bare-selector presence query only sees a series scraped within the default 5m staleness
    // window at one of the 1-2 instants a single-step range query evaluates -- a value the rate
    // query itself found is proof enough that the series exists, even if presence missed it.
    const presence: PrometheusRangeQueryResult = { result: [{ metric: { job: 'api' }, values: [[0, '1']] }] };
    const weights: PrometheusRangeQueryResult = {
      result: [
        { metric: { job: 'api' }, values: [[0, '1']] },
        { metric: { job: 'ghost' }, values: [[0, '99']] },
      ],
    };
    expect(mergePresenceAndWeights(presence, weights, 'job')).toEqual([
      { value: 'ghost', count: 99, percentage: 99 },
      { value: 'api', count: 1, percentage: 1 },
    ]);
  });

  it('returns an empty array when nothing is present', () => {
    expect(mergePresenceAndWeights({ result: [] }, { result: [] }, 'job')).toEqual([]);
  });
});
