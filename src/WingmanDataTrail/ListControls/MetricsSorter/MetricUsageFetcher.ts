import { fetchAlertingMetrics } from './fetchers/fetchAlertingMetrics';
import { fetchDashboardMetrics, type MetricUsageDetails } from './fetchers/fetchDashboardMetrics';

interface MetricsUsageState {
  metrics: Record<string, MetricUsageDetails>;
  metricsPromise: Promise<Record<string, MetricUsageDetails>> | undefined;
  fetcher: () => Promise<Record<string, MetricUsageDetails>>;
}

export type MetricUsageType = 'dashboard-usage' | 'alerting-usage';
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

  public getUsageMetrics(usageType: MetricUsageType): Promise<Record<string, MetricUsageDetails>> {
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
    return this.getUsageMetrics(usageType).then((metrics) => metrics[metricName]?.count ?? 0);
  }
}
