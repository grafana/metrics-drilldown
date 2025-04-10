import { SceneVariableValueChangedEvent, type QueryVariable } from '@grafana/scenes';

import { getTrailFor } from 'utils';
import {
  fetchAlertingMetrics,
  fetchDashboardMetrics,
  sortMetricsAlphabetically,
  sortMetricsByCount,
  sortMetricsReverseAlphabetically,
  type SortingOption,
} from 'WingmanDataTrail/HeaderControls/MetricsSorter/MetricsSorter';

import { areArraysEqual } from './helpers/areArraysEqual';

export class MetricsVariableSortEngine {
  private variable: QueryVariable;
  private lastMetrics: string[];
  private sortBy?: SortingOption;

  constructor(variable: QueryVariable) {
    this.variable = variable;
    this.sortBy = undefined;
    this.lastMetrics = [];
  }

  public async sort(sortBy = this.sortBy) {
    const metrics = this.variable.state.options.map((option) => option.value as string);

    if (sortBy === this.sortBy && areArraysEqual(metrics, this.lastMetrics)) {
      return;
    }

    let sortedMetrics: string[];

    switch (sortBy) {
      case 'dashboard-usage':
        sortedMetrics = await this.sortByDashboardUsage(metrics, getTrailFor(this.variable).state.dashboardMetrics);
        break;

      case 'alerting-usage':
        sortedMetrics = await this.sortByAlertingUsage(metrics, getTrailFor(this.variable).state.alertingMetrics);
        break;

      case 'reverse-alphabetical':
        sortedMetrics = sortMetricsReverseAlphabetically(metrics);
        break;

      default:
        sortedMetrics = sortMetricsAlphabetically(metrics);
        break;
    }

    this.sortBy = sortBy;
    this.lastMetrics = sortedMetrics;

    this.variable.setState({
      options: sortedMetrics.map((metricName) => ({
        label: metricName,
        value: metricName,
      })),
    });

    this.notifyUpdate();
  }

  private async sortByDashboardUsage(metrics: string[], existingDashboardMetrics?: Record<string, number>) {
    try {
      const dashboardMetrics = existingDashboardMetrics ? existingDashboardMetrics : await fetchDashboardMetrics();
      return sortMetricsByCount(metrics, dashboardMetrics);
    } catch (error) {
      console.error('Failed to fetch dashboard metrics!');
      console.error(error);
      return metrics;
    }
  }

  private async sortByAlertingUsage(metrics: string[], existingAlertingMetrics?: Record<string, number>) {
    try {
      const alertingMetrics = existingAlertingMetrics ? existingAlertingMetrics : await fetchAlertingMetrics();
      return sortMetricsByCount(metrics, alertingMetrics);
    } catch (error) {
      console.error('Failed to fetch alerting metrics!');
      console.error(error);
      return metrics;
    }
  }

  private notifyUpdate() {
    // hack to force SceneByVariableRepeater to re-render
    this.variable.publishEvent(new SceneVariableValueChangedEvent(this.variable), true);
  }
}
