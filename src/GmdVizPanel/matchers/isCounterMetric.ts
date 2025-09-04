const COUNTER_METRIC_REGEX = /_(count|total|sum)$/;

export const isCounterMetric = (metric: string) => COUNTER_METRIC_REGEX.test(metric);
