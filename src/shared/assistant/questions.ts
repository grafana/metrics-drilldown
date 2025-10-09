/**
 * Assistant Questions for Grafana Metrics Drilldown
 *
 * This file contains all questions that appear in Grafana Assistant for this app.
 * Questions are organized by view/context and registered based on URL patterns.
 *
 * When adding a new view or major feature, add corresponding questions here.
 *
 * URL Patterns in Metrics Drilldown:
 * - Metrics Reducer (list view): /drilldown (no 'metric' param)
 * - Metric Scene (detail view): /drilldown?metric=...
 * - Breakdown tab: /drilldown?metric=...&actionView=breakdown
 * - Related Metrics tab: /drilldown?metric=...&actionView=related
 * - Related Logs tab: /drilldown?metric=...&actionView=logs
 */

import type { Question } from '@grafana/assistant';

// Re-export the type for convenience
export type { Question };

// ============================================================================
// METRICS REDUCER (List View)
// URL Pattern: /drilldown (no metric parameter)
// ============================================================================
export const metricsReducerQuestions: Question[] = [];

// ============================================================================
// METRIC SCENE (Detail View - General)
// URL Pattern: /drilldown?metric=... (metric parameter present)
// ============================================================================
export const metricSceneQuestions: Question[] = [];

// ============================================================================
// BREAKDOWN TAB
// URL Pattern: /drilldown?metric=...&actionView=breakdown
// ============================================================================
export const breakdownTabQuestions: Question[] = [];

// ============================================================================
// RELATED METRICS TAB
// URL Pattern: /drilldown?metric=...&actionView=related
// ============================================================================
export const relatedMetricsTabQuestions: Question[] = [];

// ============================================================================
// RELATED LOGS TAB
// URL Pattern: /drilldown?metric=...&actionView=logs
// ============================================================================
export const relatedLogsTabQuestions: Question[] = [];

