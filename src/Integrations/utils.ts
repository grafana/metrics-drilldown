import { type QueryBuilderLabelFilter } from '@grafana/prometheus';

import { type QueryMetric } from './getQueryMetrics'; // We only support label filters with the '=' operator

// We only support label filters with the '=' operator
export function isEquals(labelFilter: QueryBuilderLabelFilter) {
  return labelFilter.op === '=';
}

export function getQueryMetricLabel({ metric, labelFilters }: QueryMetric) {
  // Don't show the filter unless there is more than one entry
  if (labelFilters.length === 0) {
    return metric;
  }

  const filterExpression = labelFilters.map(({ label, op, value }) => `${label}${op}"${value}"`);
  return `${metric}{${filterExpression}}`;
}

export function createAdHocFilters(labels: QueryBuilderLabelFilter[]) {
  return labels?.map((label) => ({ key: label.label, value: label.value, operator: label.op }));
}
