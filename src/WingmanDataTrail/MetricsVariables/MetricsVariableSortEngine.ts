import { SceneVariableValueChangedEvent, type MultiValueVariable } from '@grafana/scenes';

import { getTrailFor } from 'utils';
import {
  fetchAlertingMetrics,
  fetchDashboardMetrics,
  sortMetricsAlphabetically,
  sortMetricsByCount,
  sortMetricsReverseAlphabetically,
  type SortingOption,
} from 'WingmanDataTrail/HeaderControls/MetricsSorter/MetricsSorter';

export class MetricsVariableSortEngine {
  private variable: MultiValueVariable;
  private sortBy?: SortingOption;

  constructor(variable: MultiValueVariable) {
    this.variable = variable;
    this.sortBy = undefined;
  }

  public sort(sortBy = this.sortBy, notify = true) {
    this.sortBy = sortBy;

    const trail = getTrailFor(this.variable);
    const metrics = (this.variable as MultiValueVariable).state.options.map((option) => option.value as string);

    switch (sortBy) {
      case 'dashboard-usage':
        this.sortByDashboardUsage(metrics, trail.state.dashboardMetrics);
        break;

      case 'alerting-usage':
        this.sortByAlertingUsage(metrics, trail.state.alertingMetrics);
        break;

      case 'reverse-alphabetical':
        this.variable.setState({
          options: sortMetricsReverseAlphabetically(metrics).map((metricName) => ({
            label: metricName,
            value: metricName,
          })),
        });
        break;

      default:
        this.variable.setState({
          options: sortMetricsAlphabetically(metrics).map((metricName) => ({
            label: metricName,
            value: metricName,
          })),
        });
        break;
    }

    if (notify) {
      this.notifyUpdate();
    }
  }

  private async sortByDashboardUsage(metrics: string[], existingDashboardMetrics?: Record<string, number>) {
    try {
      const dashboardMetrics = existingDashboardMetrics ? existingDashboardMetrics : await fetchDashboardMetrics();

      this.variable.setState({
        options: sortMetricsByCount(metrics, dashboardMetrics).map((metricName) => ({
          label: metricName,
          value: metricName,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch dashboard metrics!');
      console.error(error);
    }
  }

  private async sortByAlertingUsage(metrics: string[], existingAlertingMetrics?: Record<string, number>) {
    try {
      const alertingMetrics = existingAlertingMetrics ? existingAlertingMetrics : await fetchAlertingMetrics();

      this.variable.setState({
        options: sortMetricsByCount(metrics, alertingMetrics).map((metricName) => ({
          label: metricName,
          value: metricName,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch alerting metrics!');
      console.error(error);
    }
  }

  private notifyUpdate() {
    // hack to force SceneByVariableRepeater to re-render
    this.variable.publishEvent(new SceneVariableValueChangedEvent(this.variable), true);
  }
}
