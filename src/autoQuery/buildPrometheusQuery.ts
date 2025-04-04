import { type AdHocVariableFilter } from '@grafana/data';
import { isValidLegacyName, utf8Support } from '@grafana/prometheus';
import * as promql from '@grafana/promql-builder';

import { VAR_OTEL_JOIN_QUERY_EXPR } from 'shared';

import { Utf8MetricExprBuilder } from './buildUtf8Query';

export interface BuildPrometheusQueryParams {
  metric: string;
  filters: AdHocVariableFilter[];
  isRateQuery: boolean;
  useOtelJoin: boolean;
  groupings?: string[];
  ignoreUsage?: boolean;
}

export function buildPrometheusQuery({
  metric,
  filters,
  isRateQuery,
  useOtelJoin,
  groupings,
  ignoreUsage = false,
}: BuildPrometheusQueryParams): string {
  let metricPartExpr: promql.VectorExprBuilder | promql.FuncCallExprBuilder | Utf8MetricExprBuilder;

  // Check if metric name contains UTF-8 characters
  const isUtf8Metric = !isValidLegacyName(metric);

  // Convert filters to label selectors
  const labels: promql.LabelSelector[] = [];
  if (ignoreUsage) {
    labels.push({ name: '__ignore_usage__', value: '', operator: '=' });
  }
  filters?.forEach((filter) => {
    labels.push({
      name: filter.key,
      value: filter.value,
      operator: filter.operator as promql.LabelMatchingOperator,
    });
  });

  // Build metric part using promql-builder
  if (isUtf8Metric) {
    // For UTF-8 metrics, Utf8MetricExprBuilder handles the optional range internally for rate
    // Pass the range directly to the constructor if it's a rate query
    const baseUtf8Expr = new Utf8MetricExprBuilder(metric, labels, isRateQuery ? '$__rate_interval' : undefined);
    // Apply rate separately if needed, ensuring range is handled by Utf8MetricExprBuilder
    metricPartExpr = isRateQuery ? promql.rate(baseUtf8Expr) : baseUtf8Expr;
  } else {
    // For regular metrics, build vector and apply labels
    const vectorExpr = promql.vector(metric);
    labels.forEach((label) => {
      const labelName = utf8Support(label.name);
      switch (label.operator) {
        case '=':
          vectorExpr.label(labelName, label.value);
          break;
        case '!=':
          vectorExpr.labelNeq(labelName, label.value);
          break;
        case '=~':
          vectorExpr.labelMatchRegexp(labelName, label.value);
          break;
        case '!~':
          vectorExpr.labelNotMatchRegexp(labelName, label.value);
          break;
      }
    });

    // Apply rate function if needed, adding the range selector
    metricPartExpr = isRateQuery ? promql.rate(vectorExpr.range('$__rate_interval')) : vectorExpr;
  }

  // Convert the builder expression to string
  const metricPartString = metricPartExpr.toString();

  // Combine with OTel join string if requested
  const innerQueryString = useOtelJoin ? `${metricPartString} ${VAR_OTEL_JOIN_QUERY_EXPR}` : metricPartString;

  // Determine aggregation function
  const aggregator = isRateQuery ? 'sum' : 'avg';

  // Build final query using string templates
  let finalQuery: string;
  if (groupings?.length) {
    finalQuery = `${aggregator}(${innerQueryString}) by (${groupings.join(', ')})`;
  } else {
    finalQuery = `${aggregator}(${innerQueryString})`;
  }

  return finalQuery;
}
