import { dateTime, type TimeRange } from '@grafana/data';
// eslint-disable-next-line sonarjs/deprecation -- unavoidable until min Grafana >= 13.1; @grafana/runtime/unstable not on host before then
import { getDataSourceSrv } from '@grafana/runtime';
import React, { useMemo } from 'react';
import { from as rxFrom, map, switchMap, type Observable } from 'rxjs';


import { MetricDatasourceHelper, type PrometheusRuntimeDatasource } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';

import { AttributeDistribution, type ActiveFilter, type AttributeConfig, type AttributeValueCount, type DatasetContext } from './AttributeDistribution';

// v1 label-name exclusion (structural, not a business/domain list -- see decision log in
// metrics-drilldown-attribute-explorer-feature-comparison.md Section 4). __name__ is always a
// single, constant value equal to the metric being viewed, so showing it as a breakdown attribute
// would be pure noise. No priority list, exclusion list, or display-name map beyond this exists yet.
const LABELS_TO_EXCLUDE = new Set(['__name__']);

function toGrafanaTimeRange(context: DatasetContext): TimeRange {
  const from = dateTime(context.timeRange.from);
  const to = dateTime(context.timeRange.to);
  return { from, to, raw: { from, to } };
}

async function fetchAttributes(context: DatasetContext): Promise<AttributeConfig[]> {
  // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- unavoidable until min Grafana >= 13.1
  const ds = (await getDataSourceSrv().get(context.datasourceUid)) as unknown as PrometheusRuntimeDatasource;

  const labels = await MetricDatasourceHelper.fetchLabels({
    ds,
    matcher: context.query,
    timeRange: toGrafanaTimeRange(context),
  });

  return labels
    .filter((label) => !LABELS_TO_EXCLUDE.has(label))
    .map((label) => ({ attribute: label, attribute_name: label }));
}

function escapePromQLString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapePromQLRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface GroupedFilter {
  field: string;
  operator: '=' | '!=';
  values: string[];
}

// Groups active filters by field+operator so multiple selected values for the same field can be
// collapsed into a single regex alternation (OR) by callers, instead of multiple ANDed `=` matchers
// on the same label -- which would match nothing (a label can't simultaneously equal two different
// values). This is the PromQL analog of the ClickHouse/SQL adapters' IN/NOT IN grouping fix for the
// exact same mistake class (see project_errors_explorer_filter_scoping in memory / the multi-value
// bug the sql/ClickHouse adapters hit). Exported so AttributeExplorerScene can apply the same
// grouping when writing selections back to the page's VAR_FILTERS variable.
export function groupFiltersByFieldAndOperator(filters: ActiveFilter[]): GroupedFilter[] {
  const byFieldAndOp = new Map<string, GroupedFilter>();
  for (const f of filters) {
    const key = `${f.field} ${f.operator}`;
    const existing = byFieldAndOp.get(key);
    if (existing) {
      existing.values.push(f.value);
    } else {
      byFieldAndOp.set(key, { field: f.field, operator: f.operator, values: [f.value] });
    }
  }
  return Array.from(byFieldAndOp.values());
}

function buildFilterMatchers(filters: ActiveFilter[]): string {
  return groupFiltersByFieldAndOperator(filters)
    .map(({ field, operator, values }) => {
      if (values.length === 1) {
        return `${field}${operator}"${escapePromQLString(values[0])}"`;
      }
      const alternation = values.map(escapePromQLRegex).join('|');
      const regexOp = operator === '=' ? '=~' : '!~';
      return `${field}${regexOp}"^(${alternation})$"`;
    })
    .join(', ');
}

// context.query is always a single simple vector selector (metric{...}), never a composite
// expression, so splicing before the final closing brace is safe here. Exported for unit testing.
export function applyFiltersToSelector(selector: string, filters: ActiveFilter[]): string {
  if (filters.length === 0) {
    return selector;
  }
  const matchers = buildFilterMatchers(filters);
  const openBrace = selector.indexOf('{');
  const closeBrace = selector.lastIndexOf('}');
  if (openBrace === -1 || closeBrace === -1) {
    return `${selector}{${matchers}}`;
  }
  // buildQueryExpression always appends a `${filters:raw}` placeholder as its own trailing selector
  // entry so the query stays valid whether or not VAR_FILTERS is empty. When it IS empty, that
  // placeholder interpolates to an empty string, leaving a dangling trailing comma before the closing
  // brace (e.g. `metric{__ignore_usage__="", }`) -- confirmed via a real parse error in the running
  // app ("unexpected ',' in label matching") when that dangling comma wasn't stripped before joining.
  // eslint-disable-next-line sonarjs/super-linear-regex -- single quantified character class, no nested/alternating groups that could overlap; genuinely linear
  const existingContent = selector.slice(openBrace + 1, closeBrace).trim().replace(/[,\s]+$/, '');
  const insertion = existingContent.length > 0 ? `${existingContent}, ${matchers}` : matchers;
  return `${selector.slice(0, openBrace + 1)}${insertion}${selector.slice(closeBrace)}`;
}

export interface PrometheusRangeQueryResult {
  result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }>;
}

// Exported for unit testing. Takes the LAST sample of each series' range (not a sum/average across
// the window) -- this is a point-in-time series count read via a range query, not a volume metric.
export function processDistributionResponse(
  response: PrometheusRangeQueryResult | undefined,
  field: string
): AttributeValueCount[] {
  const counts: Array<{ count: number; value: string }> = [];

  for (const series of response?.result ?? []) {
    const value = series.metric[field];
    const lastSample = series.values?.[series.values.length - 1];
    const count = Number(lastSample?.[1]);
    if (value && !isNaN(count) && count > 0) {
      counts.push({ count, value });
    }
  }

  const total = counts.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) {
    return [];
  }

  return counts
    .map((c) => ({ ...c, percentage: Math.round((c.count / total) * 100) }))
    .sort((a, b) => b.percentage - a.percentage);
}

function fetchDistribution(context: DatasetContext, field: string, filters: ActiveFilter[]): Observable<AttributeValueCount[]> {
  const selector = applyFiltersToSelector(context.query, filters);
  // v1 distribution strategy (decided): series-count query, `count by (<label>) (<selector>)`.
  // Counts *series*, not event volume/occurrences -- see
  // metrics-drilldown-attribute-explorer-feature-comparison.md Section 3 for the other 3 researched
  // alternatives (raw /api/v1/series tally, volume-weighted increase(), native histogram_fraction())
  // and why this one was chosen as the simplest correct v1.
  //
  // Run as a RANGE query (/api/v1/query_range), not an instant query. Confirmed via network
  // inspection: an instant query at any anchored `time` (including the end of the viewed range)
  // returned `result: []` for every label -- including near-universal ones like `job`/`instance` --
  // even though the same metric renders fine as a range query in the main graph, and label/value
  // discovery (also served via the resource-proxy path) works fine. Every query pattern already
  // proven to work against this backend/metric in this app is range-based (the main graph,
  // MetricLabelValuesList's per-value panels); only the raw instant query behaved differently. Rather
  // than keep guessing at why instant queries return nothing here, this uses the query shape already
  // proven to work. One step covering the whole window keeps the response to ~1 point per series;
  // the last sample in each series is read as the current count.
  const query = `count by (${field}) (${selector})`;
  const startSeconds = Math.floor(context.timeRange.from / 1000);
  const endSeconds = Math.floor(context.timeRange.to / 1000);
  const stepSeconds = Math.max(1, endSeconds - startSeconds);

  // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- unavoidable until min Grafana >= 13.1
  return rxFrom(getDataSourceSrv().get(context.datasourceUid)).pipe(
    switchMap((ds) => {
      const runtimeDs = ds as unknown as PrometheusRuntimeDatasource;
      const requestUrl = `/api/v1/query_range?query=${encodeURIComponent(query)}&start=${startSeconds}&end=${endSeconds}&step=${stepSeconds}`;
      // Matches the existing raw languageProvider.request() call pattern in MetricDatasourceHelper
      // (getMetadataForMetric, fetchRecentMetrics), which also casts to any for this call.
      return rxFrom((runtimeDs.languageProvider as any).request(requestUrl)) as Observable<
        PrometheusRangeQueryResult | undefined
      >;
    }),
    map((response) => processDistributionResponse(response, field))
  );
}

export interface PrometheusAttributeExplorerProps {
  colorBars?: boolean;
  datasourceUid: string;
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  query: string;
  queryLimitLabel?: string;
  selectedFilters?: ActiveFilter[];
  timeRange: TimeRange;
}

export function PrometheusAttributeExplorer({
  colorBars,
  datasourceUid,
  selectedFilters,
  onFiltersChange,
  query,
  queryLimitLabel,
  timeRange,
}: Readonly<PrometheusAttributeExplorerProps>) {
  const numericTimeRange = useMemo(() => ({ from: timeRange.from.valueOf(), to: timeRange.to.valueOf() }), [timeRange]);

  const context: DatasetContext = useMemo(
    () => ({ datasourceUid, query, timeRange: numericTimeRange }),
    [datasourceUid, query, numericTimeRange]
  );

  return (
    <AttributeDistribution
      colorBars={colorBars}
      context={context}
      fetchAttributes={fetchAttributes}
      fetchDistribution={fetchDistribution}
      onFiltersChange={onFiltersChange}
      queryLimitLabel={queryLimitLabel}
      selectedFilters={selectedFilters}
    />
  );
}
