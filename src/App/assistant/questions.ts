/**
 * Assistant Questions for Grafana Metrics Drilldown
 *
 * This file contains all questions that appear in Grafana Assistant for this app.
 * Questions provide quick-start guidance for users exploring metrics.
 *
 * URL Pattern: /a/grafana-metricsdrilldown-app/drilldown*
 * These questions appear anywhere in the Metrics Drilldown app.
 */

import { useProvideQuestions, type Question } from '@grafana/assistant';

// ============================================================================
// METRICS DRILLDOWN - Getting Started Questions
// URL Pattern: /a/grafana-metricsdrilldown-app/drilldown* (all app pages)
// ============================================================================
export const metricsDrilldownQuestions: Question[] = [
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
    prompt: 'How can I see related metrics and logs?',
    context: [],
  },
  {
    prompt: 'How do I share a metric view with my team?',
    context: [],
  },
];

export function useMetricsDrilldownQuestions() {
  useProvideQuestions('/a/grafana-metricsdrilldown-app/drilldown*', metricsDrilldownQuestions);
}
