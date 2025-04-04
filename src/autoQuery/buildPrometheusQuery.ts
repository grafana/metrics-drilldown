import { type AdHocVariableFilter } from '@grafana/data';
import { isValidLegacyName, utf8Support } from '@grafana/prometheus';
import * as promql from '@grafana/promql-builder';

import { VAR_OTEL_JOIN_QUERY_EXPR } from 'shared';

import { Utf8MetricExprBuilder } from './buildUtf8Query';

export interface BuildPrometheusQueryParams {
  metric: string;
  filters: AdHocVariableFilter[];
  isRateQuery: boolean;
  groupings?: string[];
  ignoreUsage?: boolean;
  appendToQuery?: string;
}

export function buildPrometheusQuery({
  metric,
  filters,
  isRateQuery,
  groupings,
  ignoreUsage = false,
  appendToQuery = VAR_OTEL_JOIN_QUERY_EXPR,
}: BuildPrometheusQueryParams): string {
  let expr: promql.AggregationExprBuilder;

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

  // Use Utf8MetricExprBuilder for UTF-8 metric names
  if (isUtf8Metric) {
    const vectorExpr = new Utf8MetricExprBuilder(metric, labels, isRateQuery ? '$__rate_interval' : undefined);
    expr = isRateQuery ? promql.sum(promql.rate(vectorExpr)) : promql.avg(vectorExpr);
  } else {
    // For regular metrics, use the normal label handling
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
    expr = isRateQuery ? promql.sum(promql.rate(vectorExpr.range('$__rate_interval'))) : promql.avg(vectorExpr);
  }

  // Apply grouping if specified
  if (groupings?.length) {
    expr = expr.by(groupings);
  }

  // Convert expression to string
  let result = expr.toString();

  if (appendToQuery) {
    result += ` ${appendToQuery}`;
  }

  return result;
}
