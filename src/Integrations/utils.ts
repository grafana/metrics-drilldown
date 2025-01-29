import { type QueryBuilderLabelFilter } from '@grafana/prometheus';

import { type DashboardSceneInterface } from './dashboardIntegration';
import { type QueryMetric } from './getQueryMetrics'; // We only support label filters with the '=' operator

// We only support label filters with the '=' operator
export function isEquals(labelFilter: QueryBuilderLabelFilter) {
  return labelFilter.op === '=';
}

export function getTimeRangeStateFromDashboard(dashboard: DashboardSceneInterface) {
  return dashboard.state.$timeRange!.state;
}

export function getQueryMetricLabel({ metric, labelFilters }: QueryMetric) {
  // Don't show the filter unless there is more than one entry
  if (labelFilters.length === 0) {
    return metric;
  }

  const filter = `{${labelFilters.map(({ label, op, value }) => `${label}${op}"${value}"`)}}`;
  return `${metric}${filter}`;
}

export function createAdHocFilters(labels: QueryBuilderLabelFilter[]) {
  return labels?.map((label) => ({ key: label.label, value: label.value, operator: label.op }));
}
