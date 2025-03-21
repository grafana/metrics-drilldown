export const DEFAULT_UNIT = 'short';
export const DEFAULT_RATE_UNIT = 'cps'; // Count per second

const UNIT_MAP: Record<string, string> = {
  bytes: 'bytes',
  seconds: 's',
  milliseconds: 'ms',
  bits: 'bits',
  percent: 'percent',
  count: 'short',
};

const UNIT_LIST = Object.keys(UNIT_MAP);

const RATE_UNIT_MAP: Record<string, string> = {
  bytes: 'Bps',
  bits: 'bps',
  // seconds per second is unitless
  // this may indicate a count of some resource that is active
  seconds: 'short',
  count: 'cps',
  percent: 'percent',
};

// Get unit from metric name (e.g. "go_gc_duration_seconds" -> "seconds")
export function getUnitFromMetric(metric: string) {
  if (!metric) {
    return null;
  }

  const metricLower = metric.toLowerCase();

  // First check for special patterns like CPU metrics
  if (metricLower.includes('cpu_seconds') || metricLower.includes('cpu_seconds_total')) {
    return 'seconds';
  }

  // Check for duration or latency metrics
  if (metricLower.includes('duration') || metricLower.includes('latency')) {
    return 'seconds';
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

  // Check for common units anywhere in the metric name
  for (const unit of UNIT_LIST) {
    if (metricLower.includes(unit)) {
      return unit;
    }
  }

  // Check for common patterns
  if (metricLower.endsWith('_ms') || metricLower.includes('_ms_')) {
    return 'milliseconds';
  } else if (metricLower.endsWith('_count') || metricLower.includes('_count_')) {
    return 'count';
  } else if (metricLower.includes('percentage') || metricLower.includes('ratio')) {
    return 'percent';
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
  if ((metricLower.includes('rate') || metricLower.includes('per_second')) && metricPart === 'bytes') {
    return 'Bps';
  } else if ((metricLower.includes('rate') || metricLower.includes('per_second')) && metricPart === 'bits') {
    return 'bps';
  } else if (metricLower.includes('rate') || metricLower.includes('per_second')) {
    return 'ops'; // Operations per second as a general fallback for rates
  }

  return (metricPart && RATE_UNIT_MAP[metricPart]) || DEFAULT_RATE_UNIT;
}
