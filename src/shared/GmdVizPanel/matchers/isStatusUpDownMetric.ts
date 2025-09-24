const STATUS_UPDOWN_METRIC_REGEX = /_up$/;

export const isStatusUpDownMetric = (metric: string) => metric === 'up' || STATUS_UPDOWN_METRIC_REGEX.test(metric);
