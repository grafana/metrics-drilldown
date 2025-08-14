export function isHistogramMetric(metric: string) {
  return metric.endsWith('_bucket');
}
