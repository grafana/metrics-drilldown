import { fetchAlertingMetrics } from './fetchers/fetchAlertingMetrics';
import { fetchDashboardMetrics, type MetricUsageDetails } from './fetchers/fetchDashboardMetrics';
import { type ItemsInSet } from '../../../shared/utils/utils.types';

interface MetricsUsageState {
  metrics: Record<string, MetricUsageDetails>;
  metricsPromise: Promise<Record<string, MetricUsageDetails>> | undefined;
  fetcher: () => Promise<Record<string, MetricUsageDetails>>;
}

const metricUsageTypes = new Set(['dashboard-usage', 'alerting-usage'] as const);
export type MetricUsageType = ItemsInSet<typeof metricUsageTypes>;
export const isMetricUsageType = (x: string): x is MetricUsageType => metricUsageTypes.has(x as MetricUsageType);

// Fetches and stores metric usage data for dashboards and alerting rules
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

  public getUsageDetailsForMetric(metricName: string, usageType: MetricUsageType): Promise<MetricUsageDetails> {
    return this.getUsageMetrics(usageType).then(
      (metrics) =>
        metrics[metricName] ??
        (usageType === 'dashboard-usage'
          ? { usageType: 'dashboard-usage', count: 0, dashboards: {} }
          : { usageType: 'alerting-usage', count: 0 })
    );
  }
}
