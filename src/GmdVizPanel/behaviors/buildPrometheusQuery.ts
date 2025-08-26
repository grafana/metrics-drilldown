import { type AdHocVariableFilter } from '@grafana/data';
import { isValidLegacyName, utf8Support } from '@grafana/prometheus';
import { Expression, MatchingOperator, promql } from 'tsqtsq';

const nonRateQueryFunctions = new Set(['avg', 'min', 'max'] as const);
export type NonRateQueryFunction = typeof nonRateQueryFunctions extends Set<infer T> ? T : never;
export const isNonRateQueryFunction = (value: string): value is NonRateQueryFunction =>
  nonRateQueryFunctions.has(value as NonRateQueryFunction);
const DEFAULT_NON_RATE_QUERY_FUNCTION: NonRateQueryFunction = 'avg';

export interface BuildPrometheusQueryParams {
  metric: string;
  filters: AdHocVariableFilter[];
  isRateQuery: boolean;
  groupings?: string[];
  ignoreUsage?: boolean;
  nonRateQueryFunction?: NonRateQueryFunction;
  filterExtremeValues?: boolean;
}

function getPromqlFunction(
  isRateQuery: boolean,
  nonRateQueryFunction: NonRateQueryFunction = DEFAULT_NON_RATE_QUERY_FUNCTION
): NonRateQueryFunction | 'sum' {
  return isRateQuery ? 'sum' : nonRateQueryFunction; // eslint-disable-line sonarjs/no-selector-parameter
}

export function buildPrometheusQuery({
  metric,
  filters,
  isRateQuery,
  groupings,
  ignoreUsage = false,
  nonRateQueryFunction = DEFAULT_NON_RATE_QUERY_FUNCTION,
  filterExtremeValues = false,
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
      ...filters
        .filter((filter) => filter.key !== '__name__')
        .map(({ key, value, operator }) => ({
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

  if (filterExtremeValues) {
    // Create a filter expression that excludes extreme values
    const extremeValueFilter = promql.and({
      left: metricPartString,
      right: `${metricPartString} > -Inf`,
    });
    metricPartString = extremeValueFilter;
  }

  // Add rate if needed
  if (isRateQuery) {
    metricPartString = promql.rate({ expr: metricPartString, interval: '$__rate_interval' });
  }

  // Build final query using tsqtsq
  // native histograms will not get `sum by (le)` here because they are not identified as rate queries in `determineProperties` function because they don't have the suffix bucket. The `rate` function is defined much earlier for them in `MetricVizPanel.buildQueryRunner` and is passed here as the `nonRateQueryFunction`.
  return promql[getPromqlFunction(isRateQuery, nonRateQueryFunction)]({
    expr: metricPartString,
    ...(groupings?.length ? { by: groupings } : {}),
  });
}
