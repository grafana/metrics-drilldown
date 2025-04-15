import { SceneVariableValueChangedEvent, type QueryVariable } from '@grafana/scenes';

import {
  fetchAlertingMetrics,
  fetchDashboardMetrics,
  sortMetricsByCount,
  sortMetricsWithRecentFirst,
  type SortingOption,
} from 'WingmanDataTrail/ListControls/MetricsSorter/MetricsSorter';

import { areArraysEqual } from './helpers/areArraysEqual';

export class MetricsVariableSortEngine {
  private variable: QueryVariable;
  private lastMetrics: string[];
  private sortBy?: SortingOption;
  private internal: {
    dashboardMetrics: Record<string, number>;
    alertingMetrics: Record<string, number>;
    dashboardMetricsPromise: Promise<Record<string, number>> | undefined;
    alertingMetricsPromise: Promise<Record<string, number>> | undefined;
  };

  constructor(variable: QueryVariable) {
    this.variable = variable;
    this.sortBy = undefined;
    this.lastMetrics = [];
    this.internal = {
      dashboardMetrics: {},
      alertingMetrics: {},
      dashboardMetricsPromise: undefined,
      alertingMetricsPromise: undefined,
    };
  }

  getDashboardUsageMetrics(): Promise<Record<string, number>> {
    const hasExistingDashboardMetrics =
      this.internal.dashboardMetrics && Object.keys(this.internal.dashboardMetrics).length > 0;

    if (hasExistingDashboardMetrics) {
      return Promise.resolve(this.internal.dashboardMetrics);
    }

    if (!this.internal.dashboardMetricsPromise) {
      this.internal.dashboardMetricsPromise = fetchDashboardMetrics().then((metrics) => {
        this.internal.dashboardMetrics = metrics;
        this.internal.dashboardMetricsPromise = undefined;
        return metrics;
      });
    }

    return this.internal.dashboardMetricsPromise;
  }

  getAlertingUsageMetrics(): Promise<Record<string, number>> {
    const hasExistingAlertingMetrics =
      this.internal.alertingMetrics && Object.keys(this.internal.alertingMetrics).length > 0;

    if (hasExistingAlertingMetrics) {
      return Promise.resolve(this.internal.alertingMetrics);
    }

    if (!this.internal.alertingMetricsPromise) {
      this.internal.alertingMetricsPromise = fetchAlertingMetrics().then((metrics) => {
        this.internal.alertingMetrics = metrics;
        this.internal.alertingMetricsPromise = undefined;
        return metrics;
      });
    }

    return this.internal.alertingMetricsPromise;
  }

  public getDashboardUsageForMetric(metricName: string): Promise<number> {
    return this.getDashboardUsageMetrics().then((metrics) => metrics[metricName] ?? 0);
  }

  public getAlertingUsageForMetric(metricName: string): Promise<number> {
    return this.getAlertingUsageMetrics().then((metrics) => metrics[metricName] ?? 0);
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
      const dashboardMetrics = await this.getDashboardUsageMetrics();
      return sortMetricsByCount(metrics, dashboardMetrics);
    } catch (error) {
      console.error('Failed to fetch dashboard metrics!');
      console.error(error);
      return metrics;
    }
  }

  private async sortByAlertingUsage(metrics: string[]) {
    try {
      const alertingMetrics = await this.getAlertingUsageMetrics();
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
