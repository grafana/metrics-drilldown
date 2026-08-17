import { dateTime, type TimeRange } from '@grafana/data';
// eslint-disable-next-line sonarjs/deprecation -- unavoidable until min Grafana >= 13.1; @grafana/runtime/unstable not on host before then
import { getDataSourceSrv } from '@grafana/runtime';
import React, { useMemo } from 'react';
import { from as rxFrom, map, switchMap, type Observable } from 'rxjs';


import { MetricDatasourceHelper, type PrometheusRuntimeDatasource } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';

import { AttributeDistribution, type ActiveFilter, type AttributeConfig, type AttributeValueCount, type DatasetContext } from './AttributeDistribution';

// __name__ is always the metric being viewed, so it's pure noise as an attribute.
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

// Groups by field+operator so multiple values collapse into one regex alternation instead of
// multiple ANDed `=` matchers, which would match nothing.
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
  // Strips a possible dangling trailing comma (left by an empty ${filters:raw} interpolation) before
  // joining, to avoid producing a double comma.
  // eslint-disable-next-line sonarjs/super-linear-regex -- single quantified character class, genuinely linear
  const existingContent = selector.slice(openBrace + 1, closeBrace).trim().replace(/[,\s]+$/, '');
  const insertion = existingContent.length > 0 ? `${existingContent}, ${matchers}` : matchers;
  return `${selector.slice(0, openBrace + 1)}${insertion}${selector.slice(closeBrace)}`;
}

export interface PrometheusRangeQueryResult {
  result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }>;
}

// Takes the last sample of each series' range, a point-in-time count, not a sum across the window.
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
  // Series count, not event volume. Run as a range query, not instant. One step over the whole window keeps ~1 point per series.
  const query = `count by (${field}) (${selector})`;
  const startSeconds = Math.floor(context.timeRange.from / 1000);
  const endSeconds = Math.floor(context.timeRange.to / 1000);
  const stepSeconds = Math.max(1, endSeconds - startSeconds);

  // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- unavoidable until min Grafana >= 13.1
  return rxFrom(getDataSourceSrv().get(context.datasourceUid)).pipe(
    switchMap((ds) => {
      const runtimeDs = ds as unknown as PrometheusRuntimeDatasource;
      const requestUrl = `/api/v1/query_range?query=${encodeURIComponent(query)}&start=${startSeconds}&end=${endSeconds}&step=${stepSeconds}`;
      // Matches the raw languageProvider.request() pattern already used in MetricDatasourceHelper.
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
  metricType: MetricType;
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  query: string;
  queryLimitLabel?: string;
  selectedFilters?: ActiveFilter[];
  timeRange: TimeRange;
}

export function PrometheusAttributeExplorer({
  colorBars,
  datasourceUid,
  metricType,
  selectedFilters,
  onFiltersChange,
  query,
  queryLimitLabel,
  timeRange,
}: Readonly<PrometheusAttributeExplorerProps>) {
  const numericTimeRange = useMemo(() => ({ from: timeRange.from.valueOf(), to: timeRange.to.valueOf() }), [timeRange]);

  const context: DatasetContext = useMemo(
    () => ({ datasourceUid, metricType, query, timeRange: numericTimeRange }),
    [datasourceUid, metricType, query, numericTimeRange]
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
