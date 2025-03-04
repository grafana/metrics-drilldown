import { type GroupByLabel } from './MetricVizPanel';

export function buildPrometheusQuery({
  metricName,
  groupByLabel,
}: {
  metricName: string;
  groupByLabel?: GroupByLabel;
}) {
  if (!groupByLabel) {
    return `sum(${metricName})`;
  }

  return `sum(${metricName}) by (${groupByLabel.name})`;
}
