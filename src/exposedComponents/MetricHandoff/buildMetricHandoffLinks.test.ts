import { locationUtil } from '@grafana/data';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  sceneGraph,
  SceneObjectBase,
  SceneVariableSet,
  type SceneObjectState,
} from '@grafana/scenes';

import { buildFilterExpression } from 'shared/utils/utils.queries';

import { buildMetricHandoffLinks } from './buildMetricHandoffLinks';
import { type MetricHandoffProps } from './types';

class FilterDestinationScene extends SceneObjectBase<SceneObjectState> {}

const scope: MetricHandoffProps = {
  dataSourceUid: 'prom-main',
  from: 'now-1h',
  to: 'now',
  metric: 'http_requests_total',
  queries: [{ refId: 'A', expr: 'rate(http_requests_total{job="api"}[$__rate_interval])' }],
};

function params(url: string | undefined) {
  expect(url).toBeDefined();
  return new URL(url!, 'https://grafana.example').searchParams;
}

function exploreState(url: string | undefined) {
  return JSON.parse(params(url).get('left')!);
}

function deserializeFilters(url: string | undefined) {
  const variable = new AdHocFiltersVariable({ name: 'filters', applyMode: 'manual' });
  variable.urlSync!.updateFromUrl({ 'var-filters': params(url).getAll('var-filters') });
  return variable.state.filters;
}

describe('buildMetricHandoffLinks', () => {
  it('serializes all exact Explore expressions, refIds and query options without reapplying filters', () => {
    const queries: MetricHandoffProps['queries'] = [
      {
        refId: 'requests',
        expr: 'sum(rate(requests_total{job=~"api|web",__ignore_usage__=""}[$__rate_interval]))',
        legendFormat: 'requests',
        range: true,
      },
      { refId: 'errors', expr: 'errors_total / requests_total', instant: true, hide: false },
    ];
    const snapshot = JSON.stringify(queries);
    const state = exploreState(
      buildMetricHandoffLinks({
        ...scope,
        queries,
        filters: [{ key: 'job', operator: '=', value: 'not-applied-again' }],
      }).explore
    );
    expect(state).toEqual({
      datasource: 'prom-main',
      queries: queries.map((query) => ({ ...query, datasource: { type: 'prometheus', uid: 'prom-main' } })),
      range: { from: 'now-1h', to: 'now' },
    });
    expect(JSON.stringify(queries)).toBe(snapshot);
  });

  it('uses explicit metric, quoted/regex matchers and group-by for Drilldown, not the query expression', () => {
    const drilldown = params(
      buildMetricHandoffLinks({
        ...scope,
        metric: 'request.duration_🔥',
        groupBy: 'service.name',
        filters: [
          { key: 'path', operator: '=', value: 'say "hello"\\world' },
          { key: 'job', operator: '=~', value: 'api|web' },
          { key: 'status', operator: '!~', value: '5..' },
          { key: 'region', operator: '!=', value: '' },
        ],
      }).drilldown
    );
    expect(drilldown.get('metric')).toBe('request.duration_🔥');
    expect(drilldown.get('var-ds')).toBe('prom-main');
    expect(drilldown.get('from')).toBe('now-1h');
    expect(drilldown.get('to')).toBe('now');
    expect(drilldown.get('actionView')).toBe('breakdown');
    expect(drilldown.get('var-groupby')).toBe('service.name');
    expect(drilldown.getAll('var-filters')).toEqual([
      'path|=|say "hello"\\world',
      'job|=~|api__gfp__web',
      'status|!~|5..',
      'region|!=|',
    ]);
  });

  it.each([
    { from: 1700000000000, to: 1700003600000 },
    { from: '1700000000000', to: '1700003600000' },
    { from: 0, to: 3600000 },
    { from: '2023-11-14T22:13:20Z', to: '2023-11-14T23:13:20Z' },
    { from: 'now-2h/h', to: 'now' },
  ])('preserves absolute and relative times: %j', ({ from, to }) => {
    const links = buildMetricHandoffLinks({ ...scope, from, to });
    expect(exploreState(links.explore).range).toEqual({ from: String(from), to: String(to) });
    expect(params(links.drilldown).get('from')).toBe(String(from));
    expect(params(links.drilldown).get('to')).toBe(String(to));
  });

  it('defaults Drilldown to all labels and permits metric-only navigation', () => {
    const links = buildMetricHandoffLinks({ ...scope, queries: [] });
    expect(links.explore).toBeUndefined();
    expect(params(links.drilldown).get('var-groupby')).toBe('$__all');
  });

  it('does not infer metric context from arbitrary expressions', () => {
    const links = buildMetricHandoffLinks({ ...scope, metric: undefined });
    expect(links.explore).toBeDefined();
    expect(links.drilldown).toBeUndefined();
  });

  it.each([
    undefined,
    '',
    '   ',
    'bad"name',
    'bad\\name',
    'up{job="api"}',
    'bad\nname',
    '$job',
    'requests_$suffix',
    '[[ds]]',
  ])('omits unsupported metric context %j without losing Explore', (metric) => {
    const links = buildMetricHandoffLinks({ ...scope, metric });
    expect(links.drilldown).toBeUndefined();
    expect(links.explore).toBeDefined();
  });

  it.each([
    { dataSourceUid: '' },
    { from: 'not-a-time' },
    { from: 'now-invalid' },
    { from: NaN },
    { to: Infinity },
    { from: 2000, to: 1000 },
  ])('rejects invalid common scope %j', (invalid) => {
    expect(buildMetricHandoffLinks({ ...scope, ...invalid })).toEqual({});
  });

  it.each<{ queries: MetricHandoffProps['queries'] }>([
    { queries: [] },
    { queries: [{ refId: 'A', expr: '' }] },
    { queries: [{ refId: '', expr: 'up' }] },
    {
      queries: [
        { refId: 'A', expr: 'up' },
        { refId: 'A', expr: 'other' },
      ],
    },
    { queries: [{ refId: 'A', expr: 'up', datasource: { uid: 'different' } }] },
    { queries: [{ refId: 'A', expr: 'up', datasource: { type: 'loki' } }] },
  ])('does not offer partial or cross-scope Explore targets: %j', ({ queries }) => {
    const links = buildMetricHandoffLinks({ ...scope, queries });
    expect(links.explore).toBeUndefined();
    expect(links.drilldown).toBeDefined();
  });

  it.each([
    { key: 'job', operator: '>', value: 'api' },
    { key: '$job', operator: '=', value: 'api' },
    { key: '[[ds]]', operator: '=', value: 'api' },
    { key: 'service_$suffix', operator: '=', value: 'api' },
    { key: 'job', operator: 'groupBy', value: '' },
    { key: 'job', operator: '=|', value: 'api', values: ['api', 'web'] },
    { key: '', operator: '=', value: 'api' },
    { key: 'job', operator: '=', value: 'api', values: ['api', 'web'] },
    { key: 'job', operator: '=', value: 'api', condition: 'OR' },
  ])('does not silently lose unsupported filters: %j', (filter) => {
    const links = buildMetricHandoffLinks({ ...scope, filters: [filter] });
    expect(links.drilldown).toBeUndefined();
    expect(links.explore).toBeDefined();
  });

  it.each([
    ['""', 'job=""'],
    ['${ds}', 'job="prom-main"'],
    ['$ds', 'job="prom-main"'],
    ['[[ds]]', 'job="prom-main"'],
  ])('omits Drilldown when its destination would reinterpret literal value %j', (value, destinationExpression) => {
    const destination = new FilterDestinationScene({
      $variables: new SceneVariableSet({
        variables: [new ConstantVariable({ name: 'ds', value: scope.dataSourceUid })],
      }),
    });
    const filter = { key: 'job', operator: '=', value };
    // Exercise the destination's actual legacy formatter and scene template interpolation.
    expect(sceneGraph.interpolate(destination, buildFilterExpression(filter))).toBe(destinationExpression);
    const links = buildMetricHandoffLinks({ ...scope, filters: [filter] });
    expect(links.drilldown).toBeUndefined();
    expect(exploreState(links.explore).queries[0].expr).toBe(scope.queries[0].expr);
  });

  it.each(['a,b', 'a#b', 'a|b', 'a%2Cb%23c%7Cd', '100% + %25', 'a,#|%b', '', 'say "hello"\\world', '^api-[0-9]+$'])(
    'round-trips filter value %j and unusual keys through the real Scenes URL handler',
    (value) => {
      const filters = [
        'service.name',
        'service,variant',
        'service#namespace',
        'service|kind',
        'service%23label',
        '服务_🔥',
      ].map((key) => ({ key, operator: '=~', value }));
      const links = buildMetricHandoffLinks({
        ...scope,
        metric: 'requests.duration_🔥',
        groupBy: 'service.name',
        filters,
      });
      expect(deserializeFilters(links.drilldown).map(({ key, operator, value }) => ({ key, operator, value }))).toEqual(
        filters
      );
      const drilldown = params(links.drilldown);
      expect(drilldown.get('metric')).toBe('requests.duration_🔥');
      expect(drilldown.get('var-groupby')).toBe('service.name');
      expect(drilldown.get('var-ds')).toBe(scope.dataSourceUid);
      expect(drilldown.get('from')).toBe(scope.from);
      expect(drilldown.get('to')).toBe(scope.to);
      expect(exploreState(links.explore).queries[0].expr).toBe(scope.queries[0].expr);
    }
  );

  it('accepts a real Scenes-deserialized matcher with an empty condition', () => {
    const filters = deserializeFilters('/?var-filters=job%7C%3D%7Capi');
    expect(filters).toMatchObject([{ key: 'job', operator: '=', value: 'api', condition: '' }]);
    const links = buildMetricHandoffLinks({ ...scope, filters });
    expect(deserializeFilters(links.drilldown)).toEqual(filters);
    expect(links.explore).toBeDefined();
  });

  it.each([undefined, '', 'AND'])('accepts single-matcher condition %j', (condition) => {
    const links = buildMetricHandoffLinks({
      ...scope,
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Legacy and Scenes-deserialized single matchers remain supported inputs.
      filters: [{ key: 'job', operator: '=', value: 'api', condition }],
    });
    expect(deserializeFilters(links.drilldown)).toMatchObject([{ key: 'job', operator: '=', value: 'api' }]);
  });

  it.each(['__gfp__', '__gfc__', '__gfh__'])('does not silently change literal Scenes delimiter token %s', (token) => {
    for (const filter of [
      { key: `job${token}label`, operator: '=', value: 'api' },
      { key: 'job', operator: '=', value: `api${token}web` },
    ]) {
      const links = buildMetricHandoffLinks({ ...scope, filters: [filter] });
      expect(links.drilldown).toBeUndefined();
      expect(exploreState(links.explore).queries[0].expr).toBe(scope.queries[0].expr);
    }
  });

  it.each(['', '$job', '[[ds]]', 'service_$suffix', 'bad"group', 'bad\\group', 'bad{group}', 'bad\ngroup'])(
    'suppresses only Drilldown for unsupported group-by %j',
    (groupBy) => {
      const links = buildMetricHandoffLinks({ ...scope, groupBy });
      expect(links.drilldown).toBeUndefined();
      expect(exploreState(links.explore).queries[0].expr).toBe(scope.queries[0].expr);
    }
  );

  it('encodes raw props as parameters, never as an external destination', () => {
    const links = buildMetricHandoffLinks({
      ...scope,
      dataSourceUid: '//evil.example/?next=x',
      metric: '//evil.example',
    });
    expect(new URL(links.explore!, 'https://grafana.example').origin).toBe('https://grafana.example');
    expect(new URL(links.drilldown!, 'https://grafana.example').origin).toBe('https://grafana.example');
    expect(params(links.drilldown).get('metric')).toBe('//evil.example');
  });

  it('uses Grafana base-path handling for both links', () => {
    const initialize = (appSubUrl: string) =>
      locationUtil.initialize({
        config: { appSubUrl } as Parameters<typeof locationUtil.initialize>[0]['config'],
        getTimeRangeForUrl: () => ({ from: 'now-1h', to: 'now' }),
        getVariablesUrlParams: () => ({}),
      });
    initialize('/grafana');
    try {
      const filters = [{ key: 'service,kind#name|label', operator: '=', value: 'a,b#c|d%23e' }];
      const links = buildMetricHandoffLinks({ ...scope, filters });
      expect(deserializeFilters(links.drilldown)).toMatchObject(filters);
      expect(links.explore).toMatch(/^\/grafana\/explore\?/);
      expect(links.drilldown).toMatch(/^\/grafana\/a\/grafana-metricsdrilldown-app\/drilldown\?/);
    } finally {
      initialize('');
    }
  });
});
