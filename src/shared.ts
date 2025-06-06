import { BusEventBase, BusEventWithPayload } from '@grafana/data';
import { ConstantVariable } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';

export const TRAILS_ROUTE = '/explore/metrics/trail';
export const HOME_ROUTE = '/explore/metrics';

export const VAR_FILTERS = 'filters';
export const VAR_FILTERS_EXPR = '${filters}';
export const VAR_METRIC = 'metric';
export const VAR_METRIC_EXPR = '${metric}';
export const VAR_GROUP_BY = 'groupby';
export const VAR_GROUP_BY_EXP = '${groupby}';
export const VAR_DATASOURCE = 'ds';
export const VAR_DATASOURCE_EXPR = '${ds}';
export const VAR_LOGS_DATASOURCE = 'logsDs';
export const VAR_LOGS_DATASOURCE_EXPR = '${logsDs}';
export const VAR_OTHER_METRIC_FILTERS = 'other_metric_filters';

export const LOGS_METRIC = '$__logs__';
export const KEY_SQR_METRIC_VIZ_QUERY = 'sqr-metric-viz-query';

export const trailDS = { uid: VAR_DATASOURCE_EXPR };

// Local storage keys
export const RECENT_TRAILS_KEY = 'grafana.trails.recent';
export const TRAIL_BOOKMARKS_KEY = 'grafana.trails.bookmarks';
export const TRAIL_BREAKDOWN_VIEW_KEY = 'grafana.trails.breakdown.view';
export const TRAIL_BREAKDOWN_SORT_KEY = 'grafana.trails.breakdown.sort';

export const MDP_METRIC_PREVIEW = 250;
export const MDP_METRIC_OVERVIEW = 500;

export type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function getVariablesWithMetricConstant(metric: string) {
  return [
    new ConstantVariable({
      name: VAR_METRIC,
      value: metric,
      hide: VariableHide.hideVariable,
    }),
  ];
}

export class MetricSelectedEvent extends BusEventWithPayload<string | undefined> {
  public static readonly type = 'metric-selected-event';
}

export class RefreshMetricsEvent extends BusEventBase {
  public static readonly type = 'refresh-metrics-event';
}
