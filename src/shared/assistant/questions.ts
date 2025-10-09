/**
 * Assistant Questions for Grafana Metrics Drilldown
 *
 * This file contains all questions that appear in Grafana Assistant for this app.
 * Questions are organized by view/context and registered based on URL patterns.
 *
 * When adding a new view or major feature, add corresponding questions here.
 *
 * URL Patterns in Metrics Drilldown:
 * - Metrics Reducer (list view): /a/grafana-metricsdrilldown-app/drilldown (no 'metric' param)
 * - Metric Scene (detail view): /a/grafana-metricsdrilldown-app/drilldown?metric=...
 * - Breakdown tab: /a/grafana-metricsdrilldown-app/drilldown?metric=...&actionView=breakdown
 * - Related Metrics tab: /a/grafana-metricsdrilldown-app/drilldown?metric=...&actionView=related
 * - Related Logs tab: /a/grafana-metricsdrilldown-app/drilldown?metric=...&actionView=logs
 */

import type { Question } from '@grafana/assistant';

// Re-export the type for convenience
export type { Question };

// ============================================================================
// METRICS REDUCER (List View)
// URL Pattern: /a/grafana-metricsdrilldown-app/drilldown (no metric parameter)
// ============================================================================
export const metricsReducerQuestions: Question[] = [
  {
    prompt: 'How do I search for metrics without writing PromQL?',
    context: [],
  },
  {
    prompt: 'How do I filter metrics by their name prefix or suffix?',
    context: [],
  },
  {
    prompt: 'How do I group metrics by a label to see their values?',
    context: [],
  },
  {
    prompt: 'How do I sort metrics by dashboard usage or alerting rules?',
    context: [],
  },
  {
    prompt: 'How do I filter metrics by label values?',
    context: [],
  },
];

// ============================================================================
// METRIC SCENE (Detail View - General)
// URL Pattern: /a/grafana-metricsdrilldown-app/drilldown?metric=... (metric parameter present)
// ============================================================================
export const metricSceneQuestions: Question[] = [];

// ============================================================================
// BREAKDOWN TAB
// URL Pattern: /a/grafana-metricsdrilldown-app/drilldown?metric=...&actionView=breakdown
// ============================================================================
export const breakdownTabQuestions: Question[] = [];

// ============================================================================
// RELATED METRICS TAB
// URL Pattern: /a/grafana-metricsdrilldown-app/drilldown?metric=...&actionView=related
// ============================================================================
export const relatedMetricsTabQuestions: Question[] = [];

// ============================================================================
// RELATED LOGS TAB
// URL Pattern: /a/grafana-metricsdrilldown-app/drilldown?metric=...&actionView=logs
// ============================================================================
export const relatedLogsTabQuestions: Question[] = [];

