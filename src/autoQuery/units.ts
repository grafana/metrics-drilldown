export const DEFAULT_UNIT = 'short';
export const DEFAULT_RATE_UNIT = 'cps'; // Count per second

// Unit constants
export const UNIT_BYTES = 'bytes';
export const UNIT_SECONDS = 'seconds';
export const UNIT_MILLISECONDS = 'milliseconds';
export const UNIT_BITS = 'bits';
export const UNIT_PERCENT = 'percent';
export const UNIT_COUNT = 'count';

// Rate unit constants
export const RATE_BYTES_PER_SECOND = 'Bps';
export const RATE_BITS_PER_SECOND = 'bps';
export const RATE_OPS_PER_SECOND = 'ops';

const UNIT_MAP: Record<string, string> = {
  [UNIT_BYTES]: UNIT_BYTES,
  [UNIT_SECONDS]: 's',
  [UNIT_MILLISECONDS]: 'ms',
  [UNIT_BITS]: UNIT_BITS,
  [UNIT_PERCENT]: UNIT_PERCENT,
  [UNIT_COUNT]: DEFAULT_UNIT,
};

const UNIT_LIST = Object.keys(UNIT_MAP);

const RATE_UNIT_MAP: Record<string, string> = {
  [UNIT_BYTES]: RATE_BYTES_PER_SECOND,
  [UNIT_BITS]: RATE_BITS_PER_SECOND,
  // seconds per second is unitless
  // this may indicate a count of some resource that is active
  [UNIT_SECONDS]: DEFAULT_UNIT,
  [UNIT_COUNT]: DEFAULT_RATE_UNIT,
  [UNIT_PERCENT]: UNIT_PERCENT,
};

// Get unit from metric name (e.g. "go_gc_duration_seconds" -> "seconds")
export function getUnitFromMetric(metric: string) {
  if (!metric) {
    return null;
  }

  const metricLower = metric.toLowerCase();

  // First check for special patterns like CPU metrics
  if (metricLower.includes('cpu_seconds') || metricLower.includes('cpu_seconds_total')) {
    return UNIT_SECONDS;
  }

  // Then try the suffix-based approach
  const metricParts = metricLower.split('_');

  // Check the last two parts first (common pattern)
  for (let i = metricParts.length - 1; i >= Math.max(0, metricParts.length - 2); i--) {
    const part = metricParts[i];
    if (UNIT_LIST.includes(part)) {
      return part;
    }
  }

  // Check for common patterns
  if (metricLower.endsWith('_ms') || metricLower.includes('_ms_')) {
    return UNIT_MILLISECONDS;
  } else if (metricLower.endsWith('_count') || metricLower.includes('_count_')) {
    return UNIT_COUNT;
  } else if (metricLower.endsWith('_percentage') || metricLower.endsWith('_ratio')) {
    return UNIT_PERCENT;
  }

  return null;
}

// Get Grafana unit for a panel (e.g. "go_gc_duration_seconds" -> "s")
export function getUnit(metricName: string | undefined) {
  if (!metricName) {
    return DEFAULT_UNIT;
  }

  const metricPart = getUnitFromMetric(metricName);
  return (metricPart && UNIT_MAP[metricPart]) || DEFAULT_UNIT;
}

export function getPerSecondRateUnit(metricName: string | undefined) {
  if (!metricName) {
    return DEFAULT_RATE_UNIT;
  }

  const metricPart = getUnitFromMetric(metricName);

  // Special case for rate metrics
  const metricLower = metricName.toLowerCase();
  if ((metricLower.includes('rate') || metricLower.includes('per_second')) && metricPart === UNIT_BYTES) {
    return RATE_BYTES_PER_SECOND;
  } else if ((metricLower.includes('rate') || metricLower.includes('per_second')) && metricPart === UNIT_BITS) {
    return RATE_BITS_PER_SECOND;
  } else if (metricLower.includes('rate') || metricLower.includes('per_second')) {
    return RATE_OPS_PER_SECOND; // Operations per second as a general fallback for rates
  }

  return (metricPart && RATE_UNIT_MAP[metricPart]) || DEFAULT_RATE_UNIT;
}
