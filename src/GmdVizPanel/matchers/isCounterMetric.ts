const COUNTER_METRIC_SUFFIXES = new Set(['count', 'total', 'sum']);

export function isCounterMetric(metric: string) {
  const parts = metric.split('_');
  const suffix = parts.at(-1);
  return suffix ? COUNTER_METRIC_SUFFIXES.has(suffix) : false;
}
