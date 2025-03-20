import * as promql from '@grafana/promql-builder';

import type { Builder, Expr } from '@grafana/promql-builder';

interface BuildPrometheusQueryParams {
  metric: string;
  filters: string;
  isRateQuery: boolean;
  otelJoinQuery: string;
  groupings?: string[];
  currentFilterCount?: number;
}

export function buildPrometheusQuery(params: BuildPrometheusQueryParams): string {
  const { metric, filters, isRateQuery, otelJoinQuery, groupings, currentFilterCount = 0 } = params;

  // For preview panels, we need to handle template variables differently
  if (filters === '${filters}') {
    const ignoreUsage = currentFilterCount > 0 ? '{__ignore_usage__="",${filters}}' : '{__ignore_usage__=""}';
    return `avg(\${metric}${ignoreUsage} ${otelJoinQuery})`;
  }

  // Start building the query with the base vector
  let query: Builder<Expr> = promql.vector(metric);

  // Add filters if present and not a template variable
  if (filters && filters !== '{}' && !filters.includes('${')) {
    try {
      const filterObj = JSON.parse(filters);
      Object.entries(filterObj).forEach(([key, value]) => {
        query = (query as promql.VectorExprBuilder).label(key, value as string);
      });
    } catch (e) {
      // If parsing fails, assume it's a template variable and use it as is
      query = (query as promql.VectorExprBuilder).label('__name__', metric);
    }
  }

  // Apply rate if needed
  if (isRateQuery) {
    query = promql.rate((query as promql.VectorExprBuilder).range('$__rate_interval'));
  }

  // Apply aggregation based on query type
  if (isRateQuery) {
    query = promql.sum(query);
  } else {
    query = promql.avg(query);
  }

  // Apply grouping if specified
  if (groupings && groupings.length > 0) {
    query = (query as promql.AggregationExprBuilder).by(groupings);
  }

  // Build the expression and convert to string
  let result = query.build().toString();

  // Append OTel join query if present
  if (otelJoinQuery) {
    result += ` ${otelJoinQuery}`;
  }

  return result;
}
