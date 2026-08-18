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

// Structural labels: not real dimensions of the observed request, but metadata about the metric's own
// shape. le/quantile are Prometheus-native (identify which bucket/quantile series a sample belongs
// to). asserts_metric_latency is Asserts-injected and structural for the same reason, confirmed live:
// its value differs between a metric family's sibling series (e.g. "histogram_seconds" on the _bucket
// series vs "count" on the _count series for the identical family), which a genuine per-request label
// never does. Native histograms have no per-bucket series, so le doesn't apply there.
const STRUCTURAL_LABELS_BY_TYPE: Partial<Record<MetricType, string[]>> = {
  'classic-histogram': ['le', 'asserts_metric_latency'],
  summary: ['quantile'],
};

// Exported for unit testing.
export function getLabelsToExclude(metricType: MetricType): Set<string> {
  const structuralLabels = STRUCTURAL_LABELS_BY_TYPE[metricType] ?? [];
  return new Set([...ALWAYS_EXCLUDED_LABELS, ...structuralLabels]);
}

export interface HistogramRange {
  lowerSeconds: number;
  upperSeconds: number;
}

// Placeholder default, not a product decision: "over 1s" is a common latency-RCA question, but the
// right default was never validated against this metric's actual unit or distribution. Now editable
// via ExploreAttributesAction's tooltip (surfaced there, not hidden), which is why it's exported.
// Shared by both histogram types (classic and native): no evidence either needs a different default.
export const DEFAULT_HISTOGRAM_RANGE: HistogramRange = { lowerSeconds: 1, upperSeconds: Number.POSITIVE_INFINITY };

// Both histogram types get an editable fraction-in-range threshold and the same tooltip treatment;
// summary/info/etc do not, since only histogram-shaped metrics have a bucket structure for a
// threshold to be evaluated against.
export function isHistogramWithThreshold(metricType: MetricType): boolean {
  return metricType === 'classic-histogram' || metricType === 'native-histogram';
}

function formatPromQLBound(seconds: number): string {
  if (seconds === Number.POSITIVE_INFINITY) {
    return '+Inf';
  }
  if (seconds === Number.NEGATIVE_INFINITY) {
    return '-Inf';
  }
  return String(seconds);
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

// rate() (and, by extension, a fraction of a rate) is a per-second value, not an event count, and is
// often under 1 for a single label value, so displaying it directly reads as a near-duplicate of
// percentage. Per Prometheus's own docs, increase(v[d]) "is syntactic sugar for rate(v) multiplied by
// the number of seconds," so multiplying an already-fetched rate by the query window gives the same
// estimated absolute count increase() would, without a second query.
function toWindowCount(ratePerSecond: number, windowSeconds: number): number {
  return Math.round(ratePerSecond * windowSeconds);
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
// doesn't exist. `presence` answers the first question, `weights` the second, unioned because the
// bare-selector presence query only sees a series scraped within Prometheus's default 5m staleness
// window at one of the 1-2 instants this single-step range query evaluates, while a value the rate
// query itself found is proof enough that the series exists in the wider window. Exported for unit testing.
export function mergePresenceAndWeights(
  presence: PrometheusRangeQueryResult | undefined,
  weights: PrometheusRangeQueryResult | undefined,
  field: string,
  windowSeconds: number
): AttributeValueCount[] {
  const weightByValue = extractLastSampleByValue(weights, field);
  const presentValues = new Set([...extractLastSampleByValue(presence, field).keys(), ...weightByValue.keys()]);

  const counts = Array.from(presentValues, (value) => ({ value, rate: weightByValue.get(value) ?? 0 }));
  const total = counts.reduce((sum, c) => sum + c.rate, 0);

  return counts
    .map((c) => ({
      value: c.value,
      count: toWindowCount(c.rate, windowSeconds),
      percentage: total > 0 ? Math.round((c.rate / total) * 100) : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

// C2 (fraction-in-range-by-label): each label value's percentage is its own share of ITS OWN traffic
// that falls in the configured range (a self-ratio, like a per-host error rate), not a normalized
// split of a whole: values don't need to sum to 100%, unlike processDistributionResponse/
// mergePresenceAndWeights. count is that label's absolute in-range volume (fraction * total); impliedTotal
// carries its total volume through opaquely (see AttributeValueCount) for an optional per-row tooltip.
// Presence is the union of both queries' keys, not just the fraction query's: histogram_fraction
// returns NaN (dropped by extractLastSampleByValue) for a label with zero observations in this
// window, so relying on the fraction map alone would silently hide a genuinely-zero label instead of
// showing it at 0%. Exported for unit testing.
export function processFractionResponse(
  fraction: PrometheusRangeQueryResult | undefined,
  totalCount: PrometheusRangeQueryResult | undefined,
  field: string,
  windowSeconds: number
): AttributeValueCount[] {
  const fractionByValue = extractLastSampleByValue(fraction, field);
  const totalByValue = extractLastSampleByValue(totalCount, field);
  const presentValues = new Set([...fractionByValue.keys(), ...totalByValue.keys()]);

  return Array.from(presentValues, (value) => {
    const frac = fractionByValue.get(value) ?? 0;
    const total = totalByValue.get(value) ?? 0;
    return {
      value,
      count: toWindowCount(frac * total, windowSeconds),
      impliedTotal: toWindowCount(total, windowSeconds),
      percentage: Math.round(frac * 100),
    };
  }).sort((a, b) => b.percentage - a.percentage);
}

// "Observations" rather than a noun guessed from the metric name (e.g. "requests"): Prometheus's own
// docs use this term for what a histogram measures, and it's correct regardless of domain, whereas
// guessing a domain noun risks a confidently-wrong label (e.g. "requests" for a connection-pool metric).
// Exported for unit testing.
export function getHistogramValueTooltip(item: AttributeValueCount, histogramRange: HistogramRange): string | undefined {
  if (item.impliedTotal === undefined) {
    return undefined;
  }
  return t(
    'attribute-explorer.value-tooltip-histogram',
    '{{count}} ({{percentage}}%) of the ~{{total}} observations are {{range}}.',
    {
      count: item.count,
      percentage: item.percentage,
      range: formatHistogramRangeLabel(histogramRange),
      total: item.impliedTotal,
    }
  );
}

// stepSeconds, not Grafana's $__rate_interval macro, for every rate()/histogram_fraction() query in
// this file. (1) $__rate_interval is only resolved by Grafana's own query pipeline (a
// SceneQueryRunner's applyTemplateVariables); runRangeQuery bypasses that with a raw HTTP request, so
// the literal unresolved text would reach Prometheus and error. (2) $__rate_interval is sized for a
// smoothed per-point curve across many datapoints (roughly 4x the scrape interval); this sidebar
// computes one aggregate value over the *entire* window instead, so the interval should be the
// window's own width, not a per-point smoothing interval. Exported for unit testing.
export function getRangeQueryWindow(context: DatasetContext) {
  const startSeconds = Math.floor(context.timeRange.from / 1000);
  const endSeconds = Math.floor(context.timeRange.to / 1000);
  // Clamped to at least 1s: a zero- or negative-width range (from === to, or a corrupted range where
  // to < from) would otherwise produce an invalid PromQL duration like [0s] or [-30s].
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

// Classic histograms expose _bucket/_sum/_count as sibling series, a standard Prometheus convention.
// histogram_count() only works on native histogram samples, not classic bucket vectors (confirmed
// live: it returned an empty result against the identical inner vector a working histogram_fraction()
// call used); the total count for a classic histogram comes from its _count sibling series instead.
export function toCountMetricSelector(bucketSelector: string): string {
  const openBrace = bucketSelector.indexOf('{');
  const metricName = openBrace === -1 ? bucketSelector : bucketSelector.slice(0, openBrace);
  const rest = openBrace === -1 ? '' : bucketSelector.slice(openBrace);
  return `${metricName.replace(/_bucket$/, '_count')}${rest}`;
}

function fetchDistribution(context: DatasetContext, field: string, filters: ActiveFilter[]): Observable<AttributeValueCount[]> {
  const selector = applyFiltersToSelector(context.query, filters);
  const window = getRangeQueryWindow(context);

  if (context.metricType === 'classic-histogram') {
    const range = context.histogramRange ?? DEFAULT_HISTOGRAM_RANGE;
    // le stays in the inner vector for histogram_fraction to interpolate against; it's not a
    // breakdown field itself (getLabelsToExclude already drops it from the attribute list).
    const innerVector = `sum by (${field}, le) (rate(${selector}[${window.stepSeconds}s]))`;
    const fractionQuery = `histogram_fraction(${formatPromQLBound(range.lowerSeconds)}, ${formatPromQLBound(range.upperSeconds)}, ${innerVector})`;
    const totalCountQuery = `sum by (${field}) (rate(${toCountMetricSelector(selector)}[${window.stepSeconds}s]))`;

    return forkJoin([runRangeQuery(context, fractionQuery, window), runRangeQuery(context, totalCountQuery, window)]).pipe(
      map(([fraction, totalCount]) => processFractionResponse(fraction, totalCount, field, window.stepSeconds))
    );
  }

  if (context.metricType === 'native-histogram') {
    const range = context.histogramRange ?? DEFAULT_HISTOGRAM_RANGE;
    // No le: a native histogram's bucket structure is internal to the sample type, not a label to
    // group by. histogram_count() is called directly on this same vector, no sibling-metric swap:
    // unlike a classic bucket vector, this vector already carries native-histogram-typed samples,
    // which is what histogram_count() requires.
    const innerVector = `sum by (${field}) (rate(${selector}[${window.stepSeconds}s]))`;
    const fractionQuery = `histogram_fraction(${formatPromQLBound(range.lowerSeconds)}, ${formatPromQLBound(range.upperSeconds)}, ${innerVector})`;
    const totalCountQuery = `histogram_count(${innerVector})`;

    return forkJoin([runRangeQuery(context, fractionQuery, window), runRangeQuery(context, totalCountQuery, window)]).pipe(
      map(([fraction, totalCount]) => processFractionResponse(fraction, totalCount, field, window.stepSeconds))
    );
  }

  // Bare selector, not last_over_time: some aggregated metrics (e.g. Adaptive Metrics) reject
  // last_over_time with an execution error demanding a recognized aggregation like sum by (rate(...)),
  // even though the query is otherwise correctly aggregated. The resulting default-5m staleness gap
  // for counters is covered below by unioning in whatever the rate-based weight query already found.
  const presenceQuery = `count by (${field}) (${selector})`;

  if (context.metricType !== 'counter') {
    return runRangeQuery(context, presenceQuery, window).pipe(map((response) => processDistributionResponse(response, field)));
  }

  // Counters weigh by traffic, not series count, but a value's rate can legitimately be zero in
  // this window without the value itself being absent, so presence and weight are queried separately.
  const weightQuery = `sum by (${field}) (rate(${selector}[${window.stepSeconds}s]))`;

  return forkJoin([runRangeQuery(context, presenceQuery, window), runRangeQuery(context, weightQuery, window)]).pipe(
    map(([presence, weights]) => mergePresenceAndWeights(presence, weights, field, window.stepSeconds))
  );
}

function formatHistogramRangeLabel(range: HistogramRange): string {
  const { lowerSeconds, upperSeconds } = range;
  if (upperSeconds === Number.POSITIVE_INFINITY) {
    return t('attribute-explorer.histogram-range-over', 'over {{seconds}}s', { seconds: lowerSeconds });
  }
  if (lowerSeconds === Number.NEGATIVE_INFINITY || lowerSeconds === 0) {
    return t('attribute-explorer.histogram-range-under', 'under {{seconds}}s', { seconds: upperSeconds });
  }
  return t('attribute-explorer.histogram-range-between', '{{lower}}s-{{upper}}s', {
    lower: lowerSeconds,
    upper: upperSeconds,
  });
}

// Explains what the percentages actually mean, since that differs by metric type and isn't obvious
// from the UI alone: a counter's values are weighted by activity, a gauge's by series count, and
// either histogram type's by how much of each label's own traffic falls in the configured range.
function getAttributeExplorerDescription(metricType: MetricType, histogramRange: HistogramRange): string {
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
    case 'classic-histogram':
    case 'native-histogram':
      return t(
        'attribute-explorer.description-histogram',
        "Fraction-in-range weighted: Values show what share of each label's own requests are {{range}}. These percentages don't add up to 100% across labels: each is that label's own share of its own traffic, not a split of the whole.",
        { range: formatHistogramRangeLabel(histogramRange) }
      );
    default:
      return t(
        'attribute-explorer.description',
        'Spot patterns and narrow down root causes by exploring how your data breaks down across key attributes. Click any value to filter your results.'
      );
  }
}

interface AttributeExplorerHeaderProps {
  histogramRange: HistogramRange;
  metricType: MetricType;
  queryLimitLabel?: string;
}

function AttributeExplorerHeader({ histogramRange, metricType, queryLimitLabel }: Readonly<AttributeExplorerHeaderProps>) {
  const styles = useStyles2(getHeaderStyles);
  return (
    <div className={styles.header}>
      <div className={styles.title}>
        {t('attribute-explorer.title', 'Attribute Explorer')}
        <Tooltip interactive content={getAttributeExplorerDescription(metricType, histogramRange)}>
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
  attributeLabels?: Record<string, string>;
  colorBars?: boolean;
  datasourceUid: string;
  histogramRange?: HistogramRange;
  metricType: MetricType;
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  priorityAttributes?: string[];
  query: string;
  queryLimitLabel?: string;
  selectedFilters?: ActiveFilter[];
  timeRange: TimeRange;
}

export function PrometheusAttributeExplorer({
  attributeLabels,
  colorBars,
  datasourceUid,
  histogramRange,
  metricType,
  selectedFilters,
  onFiltersChange,
  priorityAttributes,
  query,
  queryLimitLabel,
  timeRange,
}: Readonly<PrometheusAttributeExplorerProps>) {
  const numericTimeRange = useMemo(() => ({ from: timeRange.from.valueOf(), to: timeRange.to.valueOf() }), [timeRange]);
  const resolvedHistogramRange = histogramRange ?? DEFAULT_HISTOGRAM_RANGE;

  const context: DatasetContext = useMemo(
    () => ({ datasourceUid, histogramRange: resolvedHistogramRange, metricType, query, timeRange: numericTimeRange }),
    [datasourceUid, resolvedHistogramRange, metricType, query, numericTimeRange]
  );

  const getValueTooltip = isHistogramWithThreshold(metricType)
    ? (item: AttributeValueCount) => getHistogramValueTooltip(item, resolvedHistogramRange)
    : undefined;

  return (
    <AttributeDistribution
      attributeLabels={attributeLabels}
      colorBars={colorBars}
      context={context}
      fetchAttributes={fetchAttributes}
      fetchDistribution={fetchDistribution}
      getValueTooltip={getValueTooltip}
      header={
        <AttributeExplorerHeader
          histogramRange={resolvedHistogramRange}
          metricType={metricType}
          queryLimitLabel={queryLimitLabel}
        />
      }
      onFiltersChange={onFiltersChange}
      priorityAttributes={priorityAttributes}
      selectedFilters={selectedFilters}
    />
  );
}
