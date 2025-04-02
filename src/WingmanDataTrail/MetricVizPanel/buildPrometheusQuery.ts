import * as promql from '@grafana/promql-builder';

import { type PrometheusFn } from './actions/ConfigureAction';

// Helper function to determine if a metric is an uptime metric
function isUptimeMetric(metricName: string): boolean {
  return metricName === 'up' || metricName.endsWith('_up');
}

interface BuildPrometheusQueryOptions {
  metricName: string;
  fn: PrometheusFn;
  matchers?: string[];
  groupByLabel?: string;
}

export function buildPrometheusQuery({ metricName, fn, matchers, groupByLabel }: BuildPrometheusQueryOptions): string {
  let expr: promql.AggregationExprBuilder;

  // Create a vector with the metric name and __ignore_usage__ label
  const vectorExpr = promql.vector(metricName);
  vectorExpr.label('__ignore_usage__', '');

  // Add label matchers to the vector expression
  if (matchers) {
    matchers.forEach((matcher) => {
      const [key, value] = matcher.split('=');
      if (key && value) {
        // Remove any single or double quotes from the value
        vectorExpr.label(key, value.replace(/['"]/g, ''));
      }
    });
  }

  // Special handling for uptime metrics - use `min` to expose downtime in any series
  if (isUptimeMetric(metricName)) {
    expr = promql.min(vectorExpr);
  }
  // Handle rate functions
  else if (fn.includes('rate')) {
    // For rate functions, we need to add $__rate_interval range
    vectorExpr.range('$__rate_interval');

    // Apply the appropriate rate function
    const rateResult = fn === 'irate' ? promql.irate(vectorExpr) : promql.rate(vectorExpr);

    // Sum the rate result
    expr = promql.sum(rateResult);
  }
  // Handle regular aggregation functions
  else {
    switch (fn) {
      case 'sum':
        expr = promql.sum(vectorExpr);
        break;
      case 'min':
        expr = promql.min(vectorExpr);
        break;
      case 'max':
        expr = promql.max(vectorExpr);
        break;
      case 'avg':
        expr = promql.avg(vectorExpr);
        break;
      default:
        // Fall back to string templates for unsupported functions
        const template = !groupByLabel
          ? `${fn}(${metricName}{__ignore_usage__=""})`
          : `${fn}(${metricName}{__ignore_usage__=""}) by (${groupByLabel})`;
        return template;
    }
  }

  // Add group by clause if needed
  if (groupByLabel) {
    return expr.by([groupByLabel]).toString();
  }

  // Return the final expression
  return expr.toString();
}
