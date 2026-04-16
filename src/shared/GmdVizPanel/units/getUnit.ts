export const DEFAULT_UNIT = 'none';
export const DEFAULT_RATE_UNIT = 'cps'; // Count per second

// Unit constants
export const UNIT_BYTES = 'bytes';
export const UNIT_SECONDS = 'seconds';
const UNIT_PERCENT = 'percent';
const UNIT_COUNT = 'count';
const UNIT_HERTZ = 'hertz';
const UNIT_CELSIUS = 'celsius';
const UNIT_VOLTS = 'volts';
const UNIT_AMPERES = 'amperes';
const UNIT_JOULES = 'joules';
const UNIT_WATTS = 'watts';
const UNIT_RATIO = 'ratio';

// Rate unit constants
export const RATE_BYTES_PER_SECOND = 'Bps';

const UNIT_MAP: Record<string, string> = {
  [UNIT_BYTES]: UNIT_BYTES,
  [UNIT_SECONDS]: 's',
  [UNIT_PERCENT]: UNIT_PERCENT,
  [UNIT_COUNT]: DEFAULT_UNIT,
  [UNIT_HERTZ]: 'hertz',
  [UNIT_CELSIUS]: 'celsius',
  [UNIT_VOLTS]: 'volt',
  [UNIT_AMPERES]: 'amp',
  [UNIT_JOULES]: 'joule',
  [UNIT_WATTS]: 'watt',
  [UNIT_RATIO]: 'percentunit',
};

const UNIT_LIST = Object.keys(UNIT_MAP); // used to check if a metric name contains any of the supported units

const RATE_UNIT_MAP: Record<string, string> = {
  [UNIT_BYTES]: RATE_BYTES_PER_SECOND,
  // seconds per second is unitless
  [UNIT_SECONDS]: DEFAULT_UNIT,
  [UNIT_COUNT]: DEFAULT_RATE_UNIT,
  [UNIT_PERCENT]: UNIT_PERCENT,
  // hertz is already "per second", so rate is meaningless
  [UNIT_HERTZ]: DEFAULT_UNIT,
  // physical units without standard per-second rates fall back to default
  [UNIT_CELSIUS]: DEFAULT_RATE_UNIT,
  [UNIT_VOLTS]: DEFAULT_RATE_UNIT,
  [UNIT_AMPERES]: DEFAULT_RATE_UNIT,
  // joules per second = watts
  [UNIT_JOULES]: 'watt',
  [UNIT_WATTS]: DEFAULT_RATE_UNIT,
  [UNIT_RATIO]: 'percentunit',
};

// Get unit from metric name (e.g. "go_gc_duration_seconds" -> "seconds")
export function getUnitFromMetric(metric: string) {
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
export function getUnit(metricName: string) {
  const metricPart = getUnitFromMetric(metricName);
  return (metricPart && UNIT_MAP[metricPart.toLowerCase()]) || DEFAULT_UNIT;
}

export function getPerSecondRateUnit(metricName: string) {
  const metricPart = getUnitFromMetric(metricName);
  return (metricPart && RATE_UNIT_MAP[metricPart]) || DEFAULT_RATE_UNIT;
}
