/**
 * Identifies gauge metrics with a value measured as a Unix timestamp in seconds
 */
export const isAgeMetric = (metric: string) => metric.endsWith('_timestamp_seconds');
