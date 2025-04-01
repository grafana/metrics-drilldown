export const DEFAULT_UNIT = 'short';
export const DEFAULT_RATE_UNIT = 'cps'; // Count per second

// Unit constants
export const UNIT_BYTES = 'bytes';
export const UNIT_SECONDS = 'seconds';
export const UNIT_PERCENT = 'percent';
export const UNIT_COUNT = 'count';

// Rate unit constants
export const RATE_BYTES_PER_SECOND = 'Bps';
export const RATE_BITS_PER_SECOND = 'bps';

const UNIT_MAP: Record<string, string> = {
  [UNIT_BYTES]: UNIT_BYTES,
  [UNIT_SECONDS]: 's',
  [UNIT_PERCENT]: UNIT_PERCENT,
  [UNIT_COUNT]: DEFAULT_UNIT,
};

const UNIT_LIST = Object.keys(UNIT_MAP); // used to check if a metric name contains any of the supported units

const RATE_UNIT_MAP: Record<string, string> = {
  [UNIT_BYTES]: RATE_BYTES_PER_SECOND,
  // seconds per second is unitless
  [UNIT_SECONDS]: DEFAULT_UNIT,
  [UNIT_COUNT]: DEFAULT_RATE_UNIT,
  [UNIT_PERCENT]: UNIT_PERCENT,
};

// Get unit from metric name (e.g. "go_gc_duration_seconds" -> "seconds")
export function getUnitFromMetric(metric: string) {
  if (!metric) {
    return null;
  }

  // Get last two parts of the metric name and check if they are valid units
  const metricParts = metric.toLowerCase().split('_').slice(-2);
  for (let i = metricParts.length - 1; i >= Math.max(0, metricParts.length - 2); i--) {
    const part = metricParts[i];
    if (UNIT_LIST.includes(part)) {
      return part;
    }
  }

  return null;
}

// Get Grafana unit for a panel (e.g. "go_gc_duration_seconds" -> "s")
export function getUnit(metricName: string | undefined) {
  if (!metricName) {
    return DEFAULT_UNIT;
  }

  const metricPart = getUnitFromMetric(metricName);
  return (metricPart && UNIT_MAP[metricPart.toLowerCase()]) || DEFAULT_UNIT;
}

export function getPerSecondRateUnit(metricName: string | undefined) {
  if (!metricName) {
    return DEFAULT_RATE_UNIT;
  }

  const metricPart = getUnitFromMetric(metricName);

  return (metricPart && RATE_UNIT_MAP[metricPart]) || DEFAULT_RATE_UNIT;
}
