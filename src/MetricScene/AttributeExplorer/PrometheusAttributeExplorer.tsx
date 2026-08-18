import { css } from '@emotion/css';
import { dateTime, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
// eslint-disable-next-line sonarjs/deprecation -- unavoidable until min Grafana >= 13.1; @grafana/runtime/unstable not on host before then
import { getDataSourceSrv } from '@grafana/runtime';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React, { useMemo } from 'react';
import { forkJoin, from as rxFrom, map, switchMap, type Observable } from 'rxjs';


import { MetricDatasourceHelper, type PrometheusRuntimeDatasource } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';

import { AttributeDistribution, type ActiveFilter, type AttributeConfig, type AttributeValueCount, type DatasetContext } from './AttributeDistribution';

// __name__ is always the metric being viewed, so it's pure noise as an attribute.
const ALWAYS_EXCLUDED_LABELS = new Set(['__name__']);

// Classic histograms and summaries carry a synthetic structural label (le / quantile) that identifies
// which bucket/quantile series a sample belongs to -- it's part of the metric's own shape, not a real
// dimension to explore. Native histograms have no per-bucket series, so nothing to exclude there.
const STRUCTURAL_LABEL_BY_TYPE: Partial<Record<MetricType, string>> = {
  'classic-histogram': 'le',
  summary: 'quantile',
};

// Exported for unit testing.
export function getLabelsToExclude(metricType: MetricType): Set<string> {
  const structuralLabel = STRUCTURAL_LABEL_BY_TYPE[metricType];
  return structuralLabel ? new Set([...ALWAYS_EXCLUDED_LABELS, structuralLabel]) : ALWAYS_EXCLUDED_LABELS;
}

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

  const labelsToExclude = getLabelsToExclude(context.metricType);
  return labels
    .filter((label) => !labelsToExclude.has(label))
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

function extractLastSampleByValue(response: PrometheusRangeQueryResult | undefined, field: string): Map<string, number> {
  const byValue = new Map<string, number>();
  for (const series of response?.result ?? []) {
    const value = series.metric[field];
    const lastSample = series.values?.[series.values.length - 1];
    const sample = Number(lastSample?.[1]);
    if (value && !isNaN(sample)) {
      byValue.set(value, sample);
    }
  }
  return byValue;
}

// For counters, whether a value exists and how much it weighs are separate questions: a value with
// a real series but zero rate in this window must still be listed, just at 0%, not dropped as if it
// doesn't exist. `presence` answers the first question, `weights` the second -- unioned, because the
// bare-selector presence query only sees a series scraped within Prometheus's default 5m staleness
// window at one of the 1-2 instants this single-step range query evaluates, while a value the rate
// query itself found is proof enough that the series exists in the wider window. Exported for unit testing.
export function mergePresenceAndWeights(
  presence: PrometheusRangeQueryResult | undefined,
  weights: PrometheusRangeQueryResult | undefined,
  field: string
): AttributeValueCount[] {
  const weightByValue = extractLastSampleByValue(weights, field);
  const presentValues = new Set([...extractLastSampleByValue(presence, field).keys(), ...weightByValue.keys()]);

  const counts = Array.from(presentValues, (value) => ({ value, count: weightByValue.get(value) ?? 0 }));
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  return counts
    .map((c) => ({ ...c, percentage: total > 0 ? Math.round((c.count / total) * 100) : 0 }))
    .sort((a, b) => b.percentage - a.percentage);
}

function getRangeQueryWindow(context: DatasetContext) {
  const startSeconds = Math.floor(context.timeRange.from / 1000);
  const endSeconds = Math.floor(context.timeRange.to / 1000);
  // Run as a range query, not instant. One step over the whole window keeps ~1 point per series.
  const stepSeconds = Math.max(1, endSeconds - startSeconds);
  return { startSeconds, endSeconds, stepSeconds };
}

function runRangeQuery(
  context: DatasetContext,
  query: string,
  window: ReturnType<typeof getRangeQueryWindow>
): Observable<PrometheusRangeQueryResult | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- unavoidable until min Grafana >= 13.1
  return rxFrom(getDataSourceSrv().get(context.datasourceUid)).pipe(
    switchMap((ds) => {
      const runtimeDs = ds as unknown as PrometheusRuntimeDatasource;
      const requestUrl = `/api/v1/query_range?query=${encodeURIComponent(query)}&start=${window.startSeconds}&end=${window.endSeconds}&step=${window.stepSeconds}`;
      // Matches the raw languageProvider.request() pattern already used in MetricDatasourceHelper.
      return rxFrom((runtimeDs.languageProvider as any).request(requestUrl)) as Observable<
        PrometheusRangeQueryResult | undefined
      >;
    })
  );
}

function fetchDistribution(context: DatasetContext, field: string, filters: ActiveFilter[]): Observable<AttributeValueCount[]> {
  const selector = applyFiltersToSelector(context.query, filters);
  const window = getRangeQueryWindow(context);
  // Bare selector, not last_over_time: some aggregated metrics (e.g. Adaptive Metrics) reject
  // last_over_time with an execution error demanding a recognized aggregation like sum by (rate(...)),
  // even though the query is otherwise correctly aggregated. The resulting default-5m staleness gap
  // for counters is covered below by unioning in whatever the rate-based weight query already found.
  const presenceQuery = `count by (${field}) (${selector})`;

  if (context.metricType !== 'counter') {
    return runRangeQuery(context, presenceQuery, window).pipe(map((response) => processDistributionResponse(response, field)));
  }

  // Counters weigh by traffic, not series count -- but a value's rate can legitimately be zero in
  // this window without the value itself being absent, so presence and weight are queried separately.
  // Window is the query's own step (one point over the whole range), not $__rate_interval: that macro
  // is resolved by the datasource query pipeline, which this raw request bypasses.
  const weightQuery = `sum by (${field}) (rate(${selector}[${window.stepSeconds}s]))`;

  return forkJoin([runRangeQuery(context, presenceQuery, window), runRangeQuery(context, weightQuery, window)]).pipe(
    map(([presence, weights]) => mergePresenceAndWeights(presence, weights, field))
  );
}

// Explains what the percentages actually mean, since that differs by metric type and isn't obvious
// from the UI alone -- a counter's values are weighted by activity, a gauge's by series count.
function getAttributeExplorerDescription(metricType: MetricType): string {
  switch (metricType) {
    case 'counter':
      return t(
        'attribute-explorer.description-counter',
        "Activity/rate-weighted: Values show each label's share of this counter's total rate (activity). A value can still appear at 0% if it exists but had no activity in this window."
      );
    case 'gauge':
      return t(
        'attribute-explorer.description-gauge',
        "Cardinality (series-count) weighted: Values show what share of this metric's series come from each label value. A label with 10 series will outweigh one with 2, regardless of the values those series report."
      );
    default:
      return t(
        'attribute-explorer.description',
        'Spot patterns and narrow down root causes by exploring how your data breaks down across key attributes. Click any value to filter your results.'
      );
  }
}

interface AttributeExplorerHeaderProps {
  metricType: MetricType;
  queryLimitLabel?: string;
}

function AttributeExplorerHeader({ metricType, queryLimitLabel }: Readonly<AttributeExplorerHeaderProps>) {
  const styles = useStyles2(getHeaderStyles);
  return (
    <div className={styles.header}>
      <div className={styles.title}>
        {t('attribute-explorer.title', 'Attribute Explorer')}
        <Tooltip interactive content={getAttributeExplorerDescription(metricType)}>
          <Icon name="info-circle" size="sm" />
        </Tooltip>
      </div>
      {queryLimitLabel && <div className={styles.queryLimit}>{queryLimitLabel}</div>}
    </div>
  );
}

// Mirrors AttributeDistribution's own header/title/queryLimit styles so the override looks identical.
function getHeaderStyles(theme: GrafanaTheme2) {
  return {
    header: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    title: css({
      alignItems: 'center',
      color: theme.colors.text.primary,
      display: 'flex',
      fontSize: theme.typography.h6.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      gap: theme.spacing(0.5),
    }),
    queryLimit: css({
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(0.5, 1),
    }),
  };
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
      header={<AttributeExplorerHeader metricType={metricType} queryLimitLabel={queryLimitLabel} />}
      onFiltersChange={onFiltersChange}
      selectedFilters={selectedFilters}
    />
  );
}
