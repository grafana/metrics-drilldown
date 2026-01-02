/**
 * Assistant Questions for Grafana Metrics Drilldown app
 *
 * This file contains all questions that appear in Grafana Assistant for this app.
 * Questions provide quick-start guidance with contextual information about app features.
 *
 * URL Pattern: /a/grafana-metricsdrilldown-app/drilldown*
 * These questions appear anywhere in the Metrics Drilldown app.
 */

import { createAssistantContextItem, type Question } from '@grafana/assistant';

// App context that provides information about Metrics Drilldown features
const appContext = createAssistantContextItem('structured', {
  hidden: true,
  title: 'Metrics Drilldown Features',
  data: {
    name: 'Metrics Drilldown',
    description: 'Queryless exploration tool for Prometheus-compatible metrics',
    features: {
      search: 'Search metrics by name in the Quick Search input',
      filters: {
        labelFilters: 'Apply label name and value filters in the Filters input',
        prefixFilters: 'Filter by metric name prefix in the sidebar',
        suffixFilters: 'Filter by metric name suffix in the sidebar',
        groupBy: 'Group metrics by label using the Group by labels filter in sidebar',
      },
      sorting: 'Sort by alphabetical, recently used, dashboard usage, or alerting rules',
      breakdown: 'View metric labels in the Breakdown tab when a metric is selected',
      relatedMetrics: 'Discover related metrics in the Related Metrics tab',
      relatedLogs: 'Discover related logs in the Related Logs tab',
      sharing: 'Use Copy URL button in panel menu to share metric views',
    },
    navigation: {
      metricsList: 'Main view shows all available metrics',
      metricDetail: 'Selecting a metric opens detailed view with tabs',
      tabs: ['Breakdown', 'Related Metrics', 'Related Logs'],
    },
  },
});

// ============================================================================
// METRICS DRILLDOWN - Getting Started Questions
// URL Pattern: /a/grafana-metricsdrilldown-app/drilldown* (all app pages)
// ============================================================================
export const metricsDrilldownQuestions: Question[] = [
  {
    prompt: 'How can I find a metric I\'m interested in?',
    context: [appContext],
  },
  {
    prompt: 'How can I see a metric\'s labels?',
    context: [appContext],
  },
  {
    prompt: 'When I find a metric of interest, what can I do next?',
    context: [appContext],
  },
];
