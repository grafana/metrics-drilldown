import { type TimeRange } from '@grafana/data';

import { MetricDatasourceHelper } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';

import { discoverBreakdownLabels, renderLeafMatcher } from './discoverBreakdownLabels';
import { parseBinaryQuery } from './parseBinaryQuery';

const ds = {} as any;
const timeRange = {} as TimeRange;

describe('renderLeafMatcher', () => {
  it('renders the __name__ form so colon recording-rule names are legal', () => {
    expect(
      renderLeafMatcher({
        metricName: 'asserts:client:error:ratio',
        labels: [
          { label: 'asserts_entity_type', op: '=', value: 'Service' },
          { label: 'asserts_error_type', op: '=~', value: '(http_errors|http_network_errors)' },
        ],
      })
    ).toBe(
      '{__name__="asserts:client:error:ratio", asserts_entity_type="Service", asserts_error_type=~"(http_errors|http_network_errors)"}'
    );
  });

  it('folds a {__name__="..."}-form selector into a single __name__ matcher (no duplicate)', () => {
    expect(
      renderLeafMatcher({
        metricName: '',
        labels: [
          { label: '__name__', op: '=', value: 'asserts:client:error:ratio' },
          { label: 'env', op: '=', value: 'prod' },
        ],
      })
    ).toBe('{__name__="asserts:client:error:ratio", env="prod"}');
  });

  it('renders a label-only selector (no metric name) without an empty __name__', () => {
    expect(renderLeafMatcher({ metricName: '', labels: [{ label: 'job', op: '=', value: 'api' }] })).toBe(
      '{job="api"}'
    );
  });

  it('emits regex/backslash values verbatim (no double-escaping)', () => {
    expect(renderLeafMatcher({ metricName: 'm', labels: [{ label: 'path', op: '=~', value: '\\.json$' }] })).toBe(
      '{__name__="m", path=~"\\.json$"}'
    );
  });
});

describe('discoverBreakdownLabels', () => {
  afterEach(() => jest.restoreAllMocks());

  it('intersects label names across the two operands and drops internal labels', async () => {
    const ratio = parseBinaryQuery(
      'sum(rate(errors_total{job="api"}[5m])) / sum(rate(requests_total{job="api"}[5m]))'
    )!;
    expect(ratio).not.toBeNull();

    const spy = jest.spyOn(MetricDatasourceHelper, 'fetchLabels').mockImplementation(({ matcher }) => {
      if (matcher.includes('errors_total')) {
        return Promise.resolve(['__name__', 'le', 'job', 'asserts_env', 'pod']);
      }
      return Promise.resolve(['__name__', 'job', 'asserts_env', 'instance']); // requests_total
    });

    const labels = await discoverBreakdownLabels({ ratio, ds, timeRange });

    // job + asserts_env are on both; pod/instance only one side; __name__/le dropped.
    expect(labels).toEqual(['asserts_env', 'job']);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('keeps a label only when present on every leaf of a side', async () => {
    const ratio = parseBinaryQuery('(a{x="1"} * b{x="1"}) / c{x="1"}')!;
    expect(ratio.left.leaves.map((l) => l.metricName)).toEqual(['a', 'b']);

    jest.spyOn(MetricDatasourceHelper, 'fetchLabels').mockImplementation(({ matcher }) => {
      if (matcher.includes('"a"')) {
        return Promise.resolve(['shared', 'only_a']);
      }
      if (matcher.includes('"b"')) {
        return Promise.resolve(['shared']); // only_a absent here -> dropped within left side
      }
      return Promise.resolve(['shared', 'only_a']); // c
    });

    const labels = await discoverBreakdownLabels({ ratio, ds, timeRange });
    expect(labels).toEqual(['shared']);
  });
});
