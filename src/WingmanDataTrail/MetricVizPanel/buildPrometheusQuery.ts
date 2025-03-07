import { type GroupByLabel } from './MetricVizPanel';

export function buildPrometheusQuery({
  metricName,
  matchers,
  groupByLabel,
  fn,
}: {
  metricName: string;
  matchers: string[];
  groupByLabel?: GroupByLabel;
  fn: string;
}) {
  // well...
  if (fn.includes('rate')) {
    return `sum(${fn}(${metricName}{__ignore_usage__=\"\",${matchers.join(',')}}[$__rate_interval]))`;
  }

  if (!groupByLabel) {
    return `${fn}(${metricName}{__ignore_usage__=\"\",${matchers.join(',')}})`;
  }

  return `${fn}(${metricName}{__ignore_usage__=\"\",${matchers.join(',')}}) by (${groupByLabel.name})`;
}
