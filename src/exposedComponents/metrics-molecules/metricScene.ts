import { dateMath, type AdHocVariableFilter } from '@grafana/data';
import { utf8Support, type PromQuery } from '@grafana/prometheus';
import {
  ConstantVariable,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneQueryRunner,
  SceneVariableSet,
} from '@grafana/scenes';

import { MetricDatasourceHelper } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { GmdVizPanel, type PanelOptions, type QueryOptions } from 'shared/GmdVizPanel/GmdVizPanel';
import { VAR_DATASOURCE, VAR_FILTERS } from 'shared/shared';
import { escapePromQLString, removeIgnoreUsageLabel } from 'shared/utils/utils.queries';
import { toSceneTimeRange } from 'shared/utils/utils.timerange';

import { MetricSceneRoot } from './MetricSceneRoot';

export interface MetricScope {
  dataSourceUid: string;
  /** Epoch milliseconds or Grafana date math / date strings. */
  from: string | number;
  /** Epoch milliseconds or Grafana date math / date strings. */
  to: string | number;
  /**
   * Plain =, !=, =~ or !~ matchers joined with AND. Values are literal strings (including '""').
   * Multi-value `values` is unsupported; condition may only be undefined, '' (default), or 'AND'.
   */
  filters?: AdHocVariableFilter[];
}

export interface MetricSceneOptions extends MetricScope {
  /**
   * A metric name, not a PromQL expression. Dotted and UTF-8 names are supported.
   * Control characters, quotes, backslashes, braces and template dollars are not supported.
   */
  metric: string;
  customRateInterval?: string;
}

// The existing UTF-8 selector builder quotes names but does not escape these characters.
// Dollar signs are also excluded because Scenes interpolates templates inside selectors.
function isSupportedName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !/[\x00-\x1f\x7f"'`\\{}$]/.test(value) &&
    !value.includes('[[')
  );
}

function isSupportedMetricFilter(filter: AdHocVariableFilter): boolean {
  if (!filter) {
    return false;
  }
  // Deprecated in Grafana, but validate it at the public boundary rather than silently ignoring OR.
  // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation
  const condition = filter.condition;
  return (
    isSupportedName(filter.key) &&
    filter.key !== '__name__' &&
    ['=', '!=', '=~', '!~'].includes(filter.operator) &&
    typeof filter.value === 'string' &&
    filter.values === undefined &&
    (condition === undefined || condition === '' || condition === 'AND')
  );
}

function parseTime(value: string | number, roundUp: boolean) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? dateMath.toDateTime(new Date(value), { roundUp }) : undefined;
  }
  return typeof value === 'string' && value.trim() ? dateMath.toDateTime(value, { roundUp }) : undefined;
}

/** Validate before constructing a scene so invalid scope cannot fall back to a default datasource/time. */
export function isValidMetricSceneOptions(options: MetricSceneOptions): boolean {
  if (
    typeof options.dataSourceUid !== 'string' ||
    !options.dataSourceUid.trim() ||
    /[\s$\x00-\x08\x0e-\x1f\x7f]/.test(options.dataSourceUid) ||
    !isSupportedName(options.metric)
  ) {
    return false;
  }

  const from = parseTime(options.from, false);
  const to = parseTime(options.to, true);
  if (!from?.isValid() || !to?.isValid() || from.valueOf() > to.valueOf()) {
    return false;
  }

  // Prometheus range-vector durations, not Grafana macros or arbitrary query fragments.
  if (
    options.customRateInterval !== undefined &&
    (typeof options.customRateInterval !== 'string' ||
      // Ordered, optional units implement the Prometheus duration grammar without accepting query fragments.
      // eslint-disable-next-line sonarjs/regex-complexity
      !/^(?:\d+y)?(?:\d+w)?(?:\d+d)?(?:\d+h)?(?:\d+m)?(?:\d+s)?(?:\d+ms)?$/.test(options.customRateInterval) ||
      !/[1-9]/.test(options.customRateInterval))
  ) {
    return false;
  }

  return (
    options.filters === undefined || (Array.isArray(options.filters) && options.filters.every(isSupportedMetricFilter))
  );
}

function serializeMetricFilter(filter: AdHocVariableFilter): string {
  // PromQL Unicode escapes protect literal dollar and legacy [[variable]] syntax through
  // datasource/backend template passes, without hiding the query's actual rate macro.
  const value = escapePromQLString(filter.value).replaceAll('$', '\\u0024').replaceAll('[', '\\u005b');
  return `${utf8Support(filter.key)}${filter.operator}"${value}"`;
}

/** No URL sync, global scene registration, app ancestor, saved preferences, or shared mutable caches. */
export function createMetricScene(
  options: MetricSceneOptions,
  queryOptions: QueryOptions = {},
  panelOptions: PanelOptions = {}
) {
  if (!isValidMetricSceneOptions(options)) {
    throw new Error('Invalid metric chart scope');
  }

  const layout = new SceneFlexLayout({ direction: 'column', children: [] });
  const scene = new MetricSceneRoot({
    body: layout,
    $timeRange: toSceneTimeRange(options.from, options.to),
    $variables: new SceneVariableSet({
      variables: [
        new ConstantVariable({ key: VAR_DATASOURCE, name: VAR_DATASOURCE, value: options.dataSourceUid }),
        new ConstantVariable({
          key: VAR_FILTERS,
          name: VAR_FILTERS,
          // :raw joins these already-escaped matchers without further string-literal escaping.
          value: (options.filters ?? []).map(serializeMetricFilter),
        }),
      ],
    }),
  });
  const panel = new GmdVizPanel({
    metric: options.metric,
    discardUserPrefs: true,
    metadataContext: new MetricDatasourceHelper(scene),
    panelOptions: { headerActions: () => [], ...panelOptions },
    queryOptions: { customRateInterval: options.customRateInterval, ...queryOptions },
  });
  layout.setState({ children: [new SceneFlexItem({ body: panel })] });
  return { scene, panel };
}

/** Observe the rendered runner, including type corrections, panel rebuilds and query fallbacks. */
export function observeMetricQueries(panel: GmdVizPanel, onQueriesChange: (queries: PromQuery[]) => void): () => void {
  let runner: SceneQueryRunner | undefined;
  let unsubscribeRunner: (() => void) | undefined;

  const emit = () => {
    if (!panel.state.metricTypeResolved || !runner) {
      return;
    }
    const source = sceneGraph.interpolate(panel, '${ds}');
    const queries: PromQuery[] = runner.state.queries.flatMap((query) =>
      typeof query.expr === 'string'
        ? [
            {
              ...query,
              expr: removeIgnoreUsageLabel(sceneGraph.interpolate(runner!, query.expr)),
              datasource: { uid: source },
            },
          ]
        : []
    );
    onQueriesChange(queries);
  };

  const watchRunner = () => {
    const nextRunner = panel.state.body && sceneGraph.findDescendents(panel.state.body, SceneQueryRunner)[0];
    if (nextRunner !== runner) {
      unsubscribeRunner?.();
      runner = nextRunner;
      const sub = runner?.subscribeToState((next, prev) => {
        if (next.queries !== prev.queries) {
          emit();
        }
      });
      unsubscribeRunner = () => sub?.unsubscribe();
    }
    emit();
  };

  const sub = panel.subscribeToState((next, prev) => {
    if (next.body !== prev.body || next.metricTypeResolved !== prev.metricTypeResolved) {
      watchRunner();
    }
  });
  watchRunner();
  return () => {
    sub.unsubscribe();
    unsubscribeRunner?.();
  };
}
