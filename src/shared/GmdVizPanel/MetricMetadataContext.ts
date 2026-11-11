import { type PromMetricsMetadataItem } from '@grafana/prometheus';

/** Metadata and probe cache scoped to the panel's datasource. DataTrail remains the app default. */
export interface MetricMetadataContext {
  getMetadataForMetric(metric: string): Promise<PromMetricsMetadataItem | undefined>;
  getCachedNativeHistogram(metric: string): boolean | undefined;
  setCachedNativeHistogram(metric: string, isNativeHistogram: boolean): void;
}
