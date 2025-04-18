import { sceneGraph, SceneVariableValueChangedEvent, type QueryVariable } from '@grafana/scenes';

import {
  MetricsSorter,
  sortMetricsByCount,
  sortMetricsWithRecentFirst,
  type SortingOption,
} from 'WingmanDataTrail/ListControls/MetricsSorter/MetricsSorter';

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
        sortedMetrics = await this.sortByDashboardUsage(metrics);
        break;

      case 'alerting-usage':
        sortedMetrics = await this.sortByAlertingUsage(metrics);
        break;

      default:
        sortedMetrics = sortMetricsWithRecentFirst(metrics);
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

  private async sortByDashboardUsage(metrics: string[]) {
    try {
      const metricsSorter = sceneGraph.findByKeyAndType(this.variable, 'metrics-sorter', MetricsSorter);
      const dashboardMetrics = await metricsSorter?.getUsageMetrics('dashboards');
      return sortMetricsByCount(metrics, dashboardMetrics);
    } catch (error) {
      console.error('Failed to fetch dashboard metrics!');
      console.error(error);
      return metrics;
    }
  }

  private async sortByAlertingUsage(metrics: string[]) {
    try {
      const metricsSorter = sceneGraph.findByKeyAndType(this.variable, 'metrics-sorter', MetricsSorter);
      const alertingMetrics = await metricsSorter?.getUsageMetrics('alerting');
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
