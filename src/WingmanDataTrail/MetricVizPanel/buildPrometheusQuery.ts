import { type GroupByLabel } from './MetricVizPanel';

export function buildPrometheusQuery({
  metricName,
  groupByLabel,
  fn,
}: {
  metricName: string;
  groupByLabel?: GroupByLabel;
  fn: string;
}) {
  // well...
  if (fn.includes('rate')) {
    return `sum(${fn}(${metricName}{__ignore_usage__=\"\"}[$__rate_interval]))`;
  }

  if (!groupByLabel) {
    return `${fn}(${metricName}{__ignore_usage__=\"\"})`;
  }

  return `${fn}(${metricName}{__ignore_usage__=\"\"}) by (${groupByLabel.name})`;
}
