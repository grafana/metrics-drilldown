export function isHistogramQuery(metric: string) {
  return metric.endsWith('_bucket');
}
