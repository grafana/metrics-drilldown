export const isPrometheusRule = (metricName: string) =>
  metricName === 'ALERTS' || metricName === 'ALERTS_FOR_STATE' || metricName.includes(':');
