import { type GrafanaAssistantMetricsDrilldownContext } from 'extensions/links';

/**
 * Failure modes for the Assistant -> Drilldown deep link (links.ts, ASSISTANT_TARGET_V0).
 * Add a tag here only when a real failure class is found (error analysis first, taxonomy second).
 */
export type LinkFailureMode =
  | 'baseline' // well-formed input must produce the expected link
  | 'navigation-flag' // navigateToMetrics gating
  | 'missing-fields' // optional/absent fields must not produce junk params
  | 'filter-operators' // each PromQL matcher operator survives the round trip
  | 'filter-value-fidelity' // filter values must not be corrupted
  | 'malformed-input'; // model-style garbage must not produce a broken link

export type LinkEvalCase = {
  id: string;
  failureMode: LinkFailureMode;
  input: Partial<GrafanaAssistantMetricsDrilldownContext> | undefined;
  /** Expected query params (repeated keys allowed). `null` means the extension must not return a link at all. */
  expectedParams: Array<[string, string]> | null;
  /**
   * A real, currently reproducing defect. The case is run with `it.failing`, so CI stays green while the bug is
   * documented, and the suite fails loudly the day the bug is fixed (remove the flag then).
   */
  knownIssue?: string;
};

export const linkCases: LinkEvalCase[] = [
  {
    id: 'baseline-full-context',
    failureMode: 'baseline',
    input: {
      navigateToMetrics: true,
      datasource_uid: 'prom-uid',
      metric: 'http_requests_total',
      start: 'now-1h',
      end: 'now',
      label_filters: ['job="api"'],
    },
    expectedParams: [
      ['metric', 'http_requests_total'],
      ['from', 'now-1h'],
      ['to', 'now'],
      ['var-ds', 'prom-uid'],
      ['var-filters', 'job|=|api'],
    ],
  },
  {
    id: 'undefined-context',
    failureMode: 'malformed-input',
    input: undefined,
    expectedParams: null,
  },
  {
    id: 'navigate-false-yields-bare-url',
    failureMode: 'navigation-flag',
    input: { navigateToMetrics: false, datasource_uid: 'prom-uid', metric: 'up' },
    expectedParams: [],
  },
  {
    id: 'no-metric-no-time',
    failureMode: 'missing-fields',
    input: { navigateToMetrics: true, datasource_uid: 'prom-uid' },
    expectedParams: [['var-ds', 'prom-uid']],
  },
  {
    id: 'no-datasource',
    failureMode: 'missing-fields',
    input: { navigateToMetrics: true, metric: 'up' },
    expectedParams: [['metric', 'up']],
  },
  {
    id: 'empty-filter-list',
    failureMode: 'missing-fields',
    input: { navigateToMetrics: true, datasource_uid: 'd', label_filters: [] },
    expectedParams: [['var-ds', 'd']],
  },
  {
    id: 'operator-equals',
    failureMode: 'filter-operators',
    input: { navigateToMetrics: true, label_filters: ['job="api"'] },
    expectedParams: [['var-filters', 'job|=|api']],
  },
  {
    id: 'operator-not-equals',
    failureMode: 'filter-operators',
    input: { navigateToMetrics: true, label_filters: ['job!="api"'] },
    expectedParams: [['var-filters', 'job|!=|api']],
  },
  {
    id: 'operator-regex-match',
    failureMode: 'filter-operators',
    input: { navigateToMetrics: true, label_filters: ['status=~"5.."'] },
    expectedParams: [['var-filters', 'status|=~|5..']],
  },
  {
    id: 'operator-regex-not-match',
    failureMode: 'filter-operators',
    input: { navigateToMetrics: true, label_filters: ['status!~"2.."'] },
    expectedParams: [['var-filters', 'status|!~|2..']],
  },
  {
    id: 'multiple-filters-keep-order',
    failureMode: 'filter-operators',
    input: { navigateToMetrics: true, label_filters: ['job="api"', 'status=~"5.."'] },
    expectedParams: [
      ['var-filters', 'job|=|api'],
      ['var-filters', 'status|=~|5..'],
    ],
  },
  {
    id: 'value-with-pipe-is-escaped',
    failureMode: 'filter-value-fidelity',
    input: { navigateToMetrics: true, label_filters: ['status=~"500|502"'] },
    // '|' is the Scenes URL delimiter, so it must be escaped to '__gfp__'
    expectedParams: [['var-filters', 'status|=~|500__gfp__502']],
  },
  {
    id: 'value-with-space-is-preserved',
    failureMode: 'filter-value-fidelity',
    input: { navigateToMetrics: true, label_filters: ['message="connection refused"'] },
    expectedParams: [['var-filters', 'message|=|connection refused']],
    knownIssue: 'parseMatcher strips every space from the value, so "connection refused" becomes "connectionrefused"',
  },
  {
    id: 'value-with-inner-quote-is-preserved',
    failureMode: 'filter-value-fidelity',
    input: { navigateToMetrics: true, label_filters: ['path="/a\'b"'] },
    expectedParams: [['var-filters', "path|=|/a'b"]],
    knownIssue: 'parseMatcher strips every quote character from the value, not only the wrapping quotes',
  },
  {
    id: 'unparseable-filter-is-dropped',
    failureMode: 'malformed-input',
    input: { navigateToMetrics: true, datasource_uid: 'd', label_filters: ['not a matcher'] },
    expectedParams: [['var-ds', 'd']],
    knownIssue: 'an unparseable filter yields an empty matcher and emits a junk "var-filters=||" param',
  },
];
