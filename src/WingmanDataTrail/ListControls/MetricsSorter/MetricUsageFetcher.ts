import { fetchAlertingMetrics } from './fetchers/fetchAlertingMetrics';
import { fetchDashboardMetrics } from './fetchers/fetchDashboardMetrics';
import { type SortingOption } from './MetricsSorter';

interface MetricsUsageState {
  metrics: Record<string, number>;
  metricsPromise: Promise<Record<string, number>> | undefined;
  fetcher: () => Promise<Record<string, number>>;
}

export type MetricUsageType = Exclude<SortingOption, 'default'>;

export class MetricUsageFetcher {
  private _usageState: Record<MetricUsageType, MetricsUsageState> = {
    'dashboard-usage': {
      metrics: {},
      metricsPromise: undefined,
      fetcher: fetchDashboardMetrics,
    },
    'alerting-usage': {
      metrics: {},
      metricsPromise: undefined,
      fetcher: fetchAlertingMetrics,
    },
  };

  public getUsageMetrics(usageType: MetricUsageType): Promise<Record<string, number>> {
    const hasExistingMetrics =
      this._usageState[usageType].metrics && Object.keys(this._usageState[usageType].metrics).length > 0;

    if (hasExistingMetrics) {
      return Promise.resolve(this._usageState[usageType].metrics);
    }

    if (!this._usageState[usageType].metricsPromise) {
      this._usageState[usageType].metricsPromise = this._usageState[usageType].fetcher().then((metrics) => {
        this._usageState[usageType].metrics = metrics;
        this._usageState[usageType].metricsPromise = undefined;
        return metrics;
      });
    }

    return this._usageState[usageType].metricsPromise;
  }

  public getUsageForMetric(metricName: string, usageType: MetricUsageType): Promise<number> {
    return this.getUsageMetrics(usageType).then((metrics) => metrics[metricName] ?? 0);
  }
}
