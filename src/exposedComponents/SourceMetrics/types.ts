import { type PromQLLabelMatcher } from '../../shared/utils/utils.promql';

// KG-supplied per-metric overrides for Metrics Drilldown.
// Mirror of asserts-app-plugin's AssertionSourceMetric.
// Extracted to a leaf module so DataTrail can import the type without a runtime cycle through utils.trail.
export type SourceMetrics = Array<{
  metricName: string;
  labels: PromQLLabelMatcher[];
  // Consumed in issue #1058: skips name-suffix heuristic and /api/v1/metadata fallback.
  metricType?: 'counter' | 'gauge' | 'histogram' | 'summary';
  // Consumed in issue #1130: replaces $__rate_interval inside rate(metric[X]).
  customRateInterval?: string;
  // Consumed in issue #1131: replaces default gauge aggregation (e.g. max_over_time).
  customFunction?: string;
}>;
