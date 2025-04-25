import { type AdHocVariableFilter } from '@grafana/data';
import { isValidLegacyName, utf8Support } from '@grafana/prometheus';
import { Expression, MatchingOperator, promql } from 'tsqtsq';

import { VAR_OTEL_JOIN_QUERY_EXPR } from 'shared';
export type NonRateQueryFunction = 'avg' | 'min' | 'max';
export const DEFAULT_NON_RATE_QUERY_FUNCTION: NonRateQueryFunction = 'avg';

export interface BuildPrometheusQueryParams {
  metric: string;
  filters: AdHocVariableFilter[];
  isRateQuery: boolean;
  useOtelJoin: boolean;
  groupings?: string[];
  ignoreUsage?: boolean;
  nonRateQueryFunction?: NonRateQueryFunction;
}

export function getPromqlFunction(
  isRateQuery: boolean,
  nonRateQueryFunction: NonRateQueryFunction = DEFAULT_NON_RATE_QUERY_FUNCTION
): NonRateQueryFunction | 'sum' {
  return isRateQuery ? 'sum' : nonRateQueryFunction;
}

export function buildPrometheusQuery({
  metric,
  filters,
  isRateQuery,
  useOtelJoin,
  groupings,
  ignoreUsage = false,
  nonRateQueryFunction = DEFAULT_NON_RATE_QUERY_FUNCTION,
}: BuildPrometheusQueryParams): string {
  // Check if metric name contains UTF-8 characters
  const isUtf8Metric = !isValidLegacyName(metric);

  const expr = new Expression({
    metric: isUtf8Metric ? '' : metric,
    values: {},
    defaultOperator: MatchingOperator.equal,
    defaultSelectors: [
      ...(isUtf8Metric ? [{ label: utf8Support(metric), operator: MatchingOperator.equal, value: '__REMOVE__' }] : []),
      ...(ignoreUsage ? [{ label: '__ignore_usage__', operator: MatchingOperator.equal, value: '' }] : []),
      ...filters.map(({ key, value, operator }) => ({
        label: utf8Support(key),
        operator: operator as MatchingOperator,
        value,
      })),
    ],
  });

  let metricPartString = expr.toString();

  // Hack to have the UTF-8 metric name in braces alongside labels,
  // but without extra quotes associated with an empty label value
  if (isUtf8Metric) {
    metricPartString = metricPartString.replace('="__REMOVE__"', '');
  }

  // Add rate if needed
  if (isRateQuery) {
    metricPartString = promql.rate({ expr: metricPartString, interval: '$__rate_interval' });
  }

  // Combine with OTel join string if requested
  const innerQueryString = useOtelJoin ? `${metricPartString} ${VAR_OTEL_JOIN_QUERY_EXPR}` : metricPartString;

  // Build final query using tsqtsq
  return promql[getPromqlFunction(isRateQuery, nonRateQueryFunction)]({
    expr: innerQueryString,
    ...(groupings?.length ? { by: groupings } : {}),
  });
}
