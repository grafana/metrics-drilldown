import { type SceneObjectUrlValues } from '@grafana/scenes';

import { type SourceMetrics } from '../exposedComponents/SourceMetrics/types';
import { KG_METRIC_TYPES, type KgMetricType } from '../shared/GmdVizPanel/matchers/mapKgMetricType';

const VALID_KG_METRIC_TYPES = new Set<KgMetricType>(KG_METRIC_TYPES);

// Multi-value URL value parser for the customFunction key.
// The scenes URL layer collapses a single-entry array to a bare string and keeps
// multi-entry as an array; this helper normalises both shapes and returns a Map
// keyed by metricName. Splits each value on the FIRST `-` so metric names
// containing `:` from recording rules are preserved intact.
export function parseCustomFunctionValues(raw: SceneObjectUrlValues[string]): Map<string, string> {
  let values: string[];
  if (Array.isArray(raw)) {
    values = raw;
  } else if (typeof raw === 'string' && raw) {
    values = [raw];
  } else {
    values = [];
  }

  const result = new Map<string, string>();
  for (const item of values) {
    const dashIdx = item.indexOf('-');
    if (dashIdx <= 0) {
      continue;
    }
    const fn = item.slice(0, dashIdx);
    const metricName = item.slice(dashIdx + 1);
    if (!fn || !metricName) {
      continue;
    }
    result.set(metricName, fn);
  }
  return result;
}

export function parseMetricTypeValues(raw: SceneObjectUrlValues[string]): Map<string, KgMetricType> {
  let values: string[];
  if (Array.isArray(raw)) {
    values = raw;
  } else if (typeof raw === 'string' && raw) {
    values = [raw];
  } else {
    values = [];
  }

  const result = new Map<string, KgMetricType>();
  for (const item of values) {
    const dashIdx = item.indexOf('-');
    if (dashIdx <= 0) {
      continue;
    }
    const type = item.slice(0, dashIdx);
    const metricName = item.slice(dashIdx + 1);
    if (!metricName || !VALID_KG_METRIC_TYPES.has(type as KgMetricType)) {
      continue;
    }
    result.set(metricName, type as KgMetricType);
  }
  return result;
}

// Build a synthesised sourceMetrics array from URL-parsed values for standalone
// hydration. Merges the single-entry customRateInterval payload (active metric
// only) with the multi-entry customFunction payload. Returns undefined when no
// metric or override entries were parsed, leaving any existing state.sourceMetrics
// untouched.
export function buildSourceMetricsOverride(
  metric: string | undefined,
  customRateInterval: string | undefined,
  customFunctionByMetric: Map<string, string>,
  metricTypeByMetric: Map<string, KgMetricType> = new Map()
): SourceMetrics | undefined {
  const allMetricNames = new Set<string>();
  if (metric) {
    allMetricNames.add(metric);
  }
  for (const name of customFunctionByMetric.keys()) {
    allMetricNames.add(name);
  }
  for (const name of metricTypeByMetric.keys()) {
    allMetricNames.add(name);
  }

  if (allMetricNames.size === 0) {
    return undefined;
  }

  return Array.from(allMetricNames).map((name) => ({
    metricName: name,
    labels: [],
    ...(name === metric && customRateInterval ? { customRateInterval } : {}),
    ...(customFunctionByMetric.has(name) ? { customFunction: customFunctionByMetric.get(name) } : {}),
    ...(metricTypeByMetric.has(name) ? { metricType: metricTypeByMetric.get(name) } : {}),
  }));
}
