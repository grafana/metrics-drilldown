import { BusEventBase, BusEventWithPayload } from '@grafana/data';
import { ConstantVariable } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';

export const HOME_ROUTE = '/explore/metrics';

export const VAR_FILTERS = 'filters';
export const VAR_FILTERS_EXPR = '${filters}';
const VAR_METRIC = 'metric';
export const VAR_METRIC_EXPR = '${metric}';
export const VAR_GROUP_BY = 'groupby';
export const VAR_DATASOURCE = 'ds';
export const VAR_DATASOURCE_EXPR = '${ds}';
export const VAR_LOGS_DATASOURCE = 'logsDs';
export const VAR_LOGS_DATASOURCE_EXPR = '${logsDs}';
export const VAR_OTHER_METRIC_FILTERS = 'other_metric_filters';

export const LOGS_METRIC = '$__logs__';

export const trailDS = { uid: VAR_DATASOURCE_EXPR };

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
