export type PrometheusMetricType = 'counter' | 'gauge' | 'histogram';

export function getPrometheusMetricType(metricName: string) {
  if (metricName.endsWith('count')) {
    return 'counter';
  }

  if (metricName.endsWith('bucket')) {
    return 'histogram';
  }

  return 'gauge';
}
