// Prometheus naming convention (https://prometheus.io/docs/practices/naming/): a metric's base name
// ends in a unit suffix, e.g. "_seconds", "_bytes", "_ratio". A classic histogram's bucket/sum/count
// family shares that same base name, so stripping those suffixes first recovers it.
const HISTOGRAM_FAMILY_SUFFIXES = ['_bucket', '_sum', '_count'];

const KNOWN_UNITS = ['seconds', 'bytes', 'ratio'] as const;

export type MetricUnit = (typeof KNOWN_UNITS)[number];

export function getMetricUnit(metricName: string): MetricUnit | undefined {
  let base = metricName;
  for (const suffix of HISTOGRAM_FAMILY_SUFFIXES) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length);
      break;
    }
  }
  return KNOWN_UNITS.find((unit) => base.endsWith(`_${unit}`));
}
