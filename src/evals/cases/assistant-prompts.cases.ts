/**
 * Failure modes for what we hand the Grafana Assistant (OpenAssistantAction.ts, QuickSearchAssistant.ts).
 * Add a tag only when a real failure class is found.
 */
export type PromptFailureMode =
  | 'prompt-content' // the prompt must name the metric and (when present) the query, with no leaked internals
  | 'context-completeness' // the context items the Assistant relies on must be present when we have the data
  | 'context-absence' // no data -> no empty/garbage context items
  | 'no-op-guard'; // blank input must not open the Assistant

export type ExplainPromptCase = {
  id: string;
  failureMode: PromptFailureMode;
  metricName: string;
  query: string;
  mustContain: string[];
  mustNotContain: string[];
};

export const explainPromptCases: ExplainPromptCase[] = [
  {
    id: 'explain-with-query',
    failureMode: 'prompt-content',
    metricName: 'http_requests_total',
    query: 'sum(rate(http_requests_total{job="api"}[5m]))',
    mustContain: ['"http_requests_total"', '`sum(rate(http_requests_total{job="api"}[5m]))`'],
    mustNotContain: ['undefined', 'null', '__ignore_usage__'],
  },
  {
    id: 'explain-without-query-omits-query-sentence',
    failureMode: 'prompt-content',
    metricName: 'up',
    query: '',
    mustContain: ['"up"'],
    mustNotContain: ['current metrics drilldown query', '``', 'undefined'],
  },
];

export type ExplainContextCase = {
  id: string;
  failureMode: PromptFailureMode;
  datasourceUid: string | undefined;
  metricName: string;
  metadata: { type?: string; help?: string; unit?: string } | null | undefined;
  /** Expected context item types, in order. */
  expectedTypes: string[];
};

export const explainContextCases: ExplainContextCase[] = [
  {
    id: 'full-context',
    failureMode: 'context-completeness',
    datasourceUid: 'prom',
    metricName: 'up',
    metadata: { type: 'gauge', help: 'Target is up', unit: '' },
    expectedTypes: ['datasource', 'label_value', 'structured'],
  },
  {
    id: 'no-metadata',
    failureMode: 'context-absence',
    datasourceUid: 'prom',
    metricName: 'up',
    metadata: undefined,
    expectedTypes: ['datasource', 'label_value'],
  },
  {
    id: 'no-datasource-but-metadata',
    failureMode: 'context-absence',
    datasourceUid: undefined,
    metricName: 'up',
    metadata: { type: 'gauge', help: 'h', unit: '' },
    expectedTypes: ['structured'],
  },
  {
    id: 'nothing-known',
    failureMode: 'context-absence',
    datasourceUid: undefined,
    metricName: 'up',
    metadata: null,
    expectedTypes: [],
  },
];

export type QuickSearchContextCase = {
  id: string;
  failureMode: PromptFailureMode;
  datasourceUid: string;
  filters: Array<{ key: string; operator: string; value: string }>;
  timeRange: { from: string; to: string };
  expectedTypes: string[];
};

export const quickSearchContextCases: QuickSearchContextCase[] = [
  {
    id: 'datasource-filters-and-time',
    failureMode: 'context-completeness',
    datasourceUid: 'prom',
    filters: [{ key: 'job', operator: '=', value: 'api' }],
    timeRange: { from: 'now-1h', to: 'now' },
    expectedTypes: ['datasource', 'structured', 'structured'],
  },
  {
    id: 'no-filters-omits-filter-item',
    failureMode: 'context-absence',
    datasourceUid: 'prom',
    filters: [],
    timeRange: { from: 'now-1h', to: 'now' },
    expectedTypes: ['datasource', 'structured'],
  },
  {
    id: 'no-datasource-omits-datasource-item',
    failureMode: 'context-absence',
    datasourceUid: '',
    filters: [],
    timeRange: { from: 'now-1h', to: 'now' },
    expectedTypes: ['structured'],
  },
];

export const blankQuestions: Array<{ id: string; question: string }> = [
  { id: 'empty', question: '' },
  { id: 'spaces', question: '   ' },
  { id: 'newline-tab', question: '\n\t' },
];
