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

import {
  breakdownTabQuestions,
  metricSceneQuestions,
  metricsReducerQuestions,
  relatedLogsTabQuestions,
  relatedMetricsTabQuestions,
} from './questions';

export function useMetricsDrilldownQuestions() {
  // Register questions for metrics list view
  useProvideQuestions('/drilldown', metricsReducerQuestions);

  // Register questions for metric detail view
  useProvideQuestions('/drilldown?*metric=*', metricSceneQuestions);

  // Register questions for breakdown tab
  useProvideQuestions('/drilldown?*actionView=breakdown*', breakdownTabQuestions);

  // Register questions for related metrics tab
  useProvideQuestions('/drilldown?*actionView=related*', relatedMetricsTabQuestions);

  // Register questions for related logs tab
  useProvideQuestions('/drilldown?*actionView=logs*', relatedLogsTabQuestions);
}

