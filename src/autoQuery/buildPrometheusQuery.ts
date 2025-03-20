import { type AdHocVariableFilter } from '@grafana/data';
import * as promql from '@grafana/promql-builder';

interface BuildPrometheusQueryParams {
  metric: string;
  filters: AdHocVariableFilter[];
  isRateQuery: boolean;
  otelJoinQuery: string;
  groupings?: string[];
  ignoreUsage?: boolean;
}

export function buildPrometheusQuery({
  metric,
  filters,
  isRateQuery,
  otelJoinQuery,
  groupings,
  ignoreUsage = false,
}: BuildPrometheusQueryParams): string {
  let expr: promql.AggregationExprBuilder;
  // Start building the query with the base vector
  const vectorExpr = promql.vector(metric);

  // Add filters if present and not a template variable
  filters?.forEach((filter) => addLabel(vectorExpr, filter));

  if (ignoreUsage) {
    vectorExpr.label('__ignore_usage__', '');
  }

  // Apply aggregation based on query type
  if (isRateQuery) {
    expr = promql.sum(promql.rate(vectorExpr.range('$__rate_interval')));
  } else {
    expr = promql.avg(vectorExpr);
  }

  // Apply grouping if specified
  if (groupings?.length) {
    expr = expr.by(groupings);
  }

  // Convert expression to string
  let result = expr.toString();

  // Append OTel join query if present
  if (otelJoinQuery) {
    result += ` ${otelJoinQuery}`;
  }

  return result;
}

function addLabel(expressionBuilder: promql.VectorExprBuilder, filter: AdHocVariableFilter) {
  switch (filter.operator) {
    case '=':
      expressionBuilder.label(filter.key, filter.value);
      break;
    case '!=':
      expressionBuilder.labelNeq(filter.key, filter.value);
      break;
    case '=~':
      expressionBuilder.labelMatchRegexp(filter.key, filter.value);
      break;
    case '!~':
      expressionBuilder.labelNotMatchRegexp(filter.key, filter.value);
      break;
    default:
      throw new Error(`Unsupported filter operator: ${filter.operator}`);
  }
}
