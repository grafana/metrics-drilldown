/**
 * Hook to register all assistant questions for Metrics Drilldown app
 *
 * This hook should be called once at the app root level (Trail component).
 * It registers different question sets for different URL patterns.
 *
 * The Grafana Assistant will automatically show relevant questions based on
 * the current URL matching the patterns defined here.
 */

import { useProvideQuestions } from '@grafana/assistant';

import { metricsDrilldownQuestions } from './questions';

export function useMetricsDrilldownQuestions() {
  // Register questions for the entire Metrics Drilldown app
  // Matches any URL in the metrics drilldown app
  useProvideQuestions('/a/grafana-metricsdrilldown-app/drilldown*', metricsDrilldownQuestions);
}

