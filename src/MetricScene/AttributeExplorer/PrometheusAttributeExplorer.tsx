import { css } from '@emotion/css';
import { dateTime, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
// eslint-disable-next-line sonarjs/deprecation -- unavoidable until min Grafana >= 13.1; @grafana/runtime/unstable not on host before then
import { getDataSourceSrv } from '@grafana/runtime';
import { Field, Icon, Input, Tooltip, useStyles2 } from '@grafana/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { forkJoin, from as rxFrom, map, switchMap, type Observable } from 'rxjs';


import { MetricDatasourceHelper, type PrometheusRuntimeDatasource } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { getUnitFromMetric } from 'shared/GmdVizPanel/units/getUnit';
import { HISTOGRAM_ATTRIBUTES_BY_DOMAIN } from 'shared/otel/histogramAttributes';
import { RESOURCE_ATTRIBUTES } from 'shared/otel/resourceAttributes';

import { AttributeDistribution, type ActiveFilter, type AttributeConfig, type AttributeValueCount, type DatasetContext } from './AttributeDistribution';

// __name__ is always the metric being viewed, so it's pure noise as an attribute.
const ALWAYS_EXCLUDED_LABELS = new Set(['__name__']);

// Structural labels: not real dimensions of the observed request, but metadata about the metric's own
// shape. le identifies which bucket series a sample belongs to. asserts_metric_latency is
// Asserts-injected and structural for the same reason, confirmed live: its value differs between a
// metric family's sibling series (e.g. "histogram_seconds" on the _bucket series vs "count" on the
// _count series for the identical family), which a genuine per-request label never does. Native
// histograms have no per-bucket series, so le doesn't apply there.
const STRUCTURAL_LABELS_BY_TYPE: Partial<Record<MetricType, string[]>> = {
  'classic-histogram': ['le', 'asserts_metric_latency'],
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

// Fallback only, used when fetchDefaultLowerThreshold has nothing to seed from yet (or returns no
// usable value): "over 1 second" is a common latency-RCA question, but on its own has no relationship
// to any given metric's actual unit or scale. Editable from the Attribute Explorer's own header once
// it's open. Shared by both histogram types: no evidence either needs a different fallback.
export const DEFAULT_HISTOGRAM_RANGE: HistogramRange = { lowerSeconds: 1, upperSeconds: Number.POSITIVE_INFINITY };

// The only two metric types this component (and the button that opens it) supports. Every other
// MetricType is excluded upstream, at the ExploreAttributesAction button and AttributeExplorerScene's
// mount gate, rather than handled here with a fallback: a generic cardinality/activity view was tried
// for gauges, counters, and the other metric types and found unhelpful, since those shapes don't have
// a bucket structure for a threshold to be evaluated against.
export type HistogramMetricType = 'classic-histogram' | 'native-histogram';

export function isHistogramWithThreshold(metricType: MetricType): metricType is HistogramMetricType {
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

// Canonical OTel attribute names (dotted), matched against a metric's discovered labels rather than
// its name. Not every pipeline converts dots to underscores (Prometheus's UTF-8 label name support can
// preserve them), so both spellings are checked. Called from AttributeExplorerScene rather than
// fetchAttributes: shape detection needs to resolve before AttributeDistribution mounts, not during it.
function toPrometheusUnderscoreForm(canonicalName: string): string {
  return canonicalName.replace(/\./g, '_');
}

// Prefers the underscored spelling if both happen to be present.
function findActualFieldSpelling(canonicalName: string, discovered: Set<string>): string | undefined {
  const underscoreForm = toPrometheusUnderscoreForm(canonicalName);
  if (discovered.has(underscoreForm)) {
    return underscoreForm;
  }
  if (discovered.has(canonicalName)) {
    return canonicalName;
  }
  return undefined;
}

// Two independent passes, not one combined list: a metric's own semantic-convention attributes (see
// HISTOGRAM_ATTRIBUTES_BY_DOMAIN) describe what kind of operation this metric measures; resource
// attributes (see RESOURCE_ATTRIBUTES) describe which service/pod/cloud-region produced it, and
// Grafana/Mimir's OTLP ingestion promotes those onto the metric's own label set regardless of the
// metric's domain. A custom, non-semantic-convention histogram can still have real resource attributes
// promoted onto it, so resource detection runs even when no domain shape matched at all.
//
// Domain pass: first domain with any field present wins, no merging across domains, since a metric's
// attributes should match exactly one semantic-convention shape (an rpc.route and a db.operation.name
// on the same metric would be a labeling bug upstream, not a metric with two shapes).
// Resource pass: every resource attribute present is included, not just the first, since a metric can
// legitimately carry many simultaneously (service.name AND k8s.pod.name AND cloud.region all promoted
// at once is the normal case, not an edge case).
// priorityAttributes uses whichever spelling matched (has to match the real label name);
// attributeLabels always shows the canonical dotted form. attributeKinds records which pass matched
// each field ('metric' vs 'resource'), so the UI can show a specific, accurate reason per attribute
// (see getAttributeBadge in the component below) instead of one shared caption for the whole group,
// which can't tell a detected attribute apart from one the user separately pinned via the combobox,
// since both land in the same priority/pinned section with no structural boundary between them.
// Exported for unit testing.
export function getOtelPriorityAttributes(labels: string[]): {
  attributeKinds: Record<string, 'metric' | 'resource'>;
  attributeLabels: Record<string, string>;
  priorityAttributes: string[];
} {
  const discovered = new Set(labels);
  const attributeKinds: Record<string, 'metric' | 'resource'> = {};
  const attributeLabels: Record<string, string> = {};
  const priorityAttributes: string[] = [];

  for (const domainFields of Object.values(HISTOGRAM_ATTRIBUTES_BY_DOMAIN)) {
    const present: string[] = [];
    for (const canonicalName of domainFields) {
      const actualField = findActualFieldSpelling(canonicalName, discovered);
      if (actualField) {
        present.push(actualField);
        attributeLabels[actualField] = canonicalName;
        attributeKinds[actualField] = 'metric';
      }
    }
    if (present.length > 0) {
      priorityAttributes.push(...present);
      break;
    }
  }

  for (const canonicalName of RESOURCE_ATTRIBUTES) {
    const actualField = findActualFieldSpelling(canonicalName, discovered);
    if (actualField && !priorityAttributes.includes(actualField)) {
      attributeLabels[actualField] = canonicalName;
      attributeKinds[actualField] = 'resource';
      priorityAttributes.push(actualField);
    }
  }

  return { attributeKinds, attributeLabels, priorityAttributes };
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
      // Two layers, applied in this order deliberately: escapePromQLRegex first produces a valid regex
      // pattern (escaping regex metacharacters, e.g. "." to "\."); escapePromQLString second makes that
      // pattern survive the outer PromQL string literal (doubling backslashes, escaping quotes). Doing
      // only the regex pass left a literal `"` in a filter value able to break out of the string
      // literal entirely, and left a literal `\` surviving PromQL's own string-unescaping as a single
      // backslash instead of the escaped-backslash the regex needs, silently matching nothing.
      const alternation = values.map((v) => escapePromQLString(escapePromQLRegex(v))).join('|');
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

// Each value's percentage is its share of the total in-range volume across every value of this
// label (sums to ~100%, same contract as every other row in the sidebar), not the old self-ratio
// (what fraction of a single value's own traffic falls in range), which let a low-volume, noisy value
// visually outrank a high-volume one. `count` (frac * total) already carries each value's own in-range
// volume, so the fix is a pure sum-and-divide over already-fetched data, no new fraction/total-count
// query needed.
//
// histogram_fraction returns NaN, not an absent sample, for a bucket vector with zero observations.
// Left uncoalesced, one zero-volume value's NaN would propagate into `count` and then into the
// reduce() below, zeroing every OTHER value's percentage in the same label, not just its own. Both
// `frac` and `total` are coerced to 0 before any arithmetic touches them, for exactly this reason.
//
// `presence` is a third, cheaper query (existence via `count()`, not `rate()`) unioned into
// presentValues alongside the fraction/total-count keys: a value can have a live series but too few
// raw samples in a narrow window for rate() to return anything, the same edge case already handled for
// counters elsewhere in this file. A value present only via `presence` still renders, at 0%, sorted to
// the bottom with a "no activity" tooltip (see getHistogramValueTooltip) rather than being hidden, on
// the same reasoning as the counter path: a label going quiet is itself an incident-response signal,
// not noise to suppress. A value absent from all three queries never enters presentValues at all, so
// there's nothing to explicitly hide for a genuinely-gone series. Exported for unit testing.
export function processFractionResponse(
  fraction: PrometheusRangeQueryResult | undefined,
  totalCount: PrometheusRangeQueryResult | undefined,
  presence: PrometheusRangeQueryResult | undefined,
  field: string,
  windowSeconds: number
): AttributeValueCount[] {
  const fractionByValue = extractLastSampleByValue(fraction, field);
  const totalByValue = extractLastSampleByValue(totalCount, field);
  const presentValues = new Set([
    ...fractionByValue.keys(),
    ...totalByValue.keys(),
    ...extractLastSampleByValue(presence, field).keys(),
  ]);

  const rows = Array.from(presentValues, (value) => {
    const rawFrac = fractionByValue.get(value) ?? 0;
    const rawTotal = totalByValue.get(value) ?? 0;
    const frac = Number.isFinite(rawFrac) ? rawFrac : 0;
    const total = Number.isFinite(rawTotal) ? rawTotal : 0;
    return { value, count: toWindowCount(frac * total, windowSeconds), impliedTotal: toWindowCount(total, windowSeconds) };
  });

  const grandTotal = rows.reduce((sum, r) => sum + r.count, 0);
  return rows
    .map((r) => ({
      value: r.value,
      count: r.count,
      impliedTotal: r.impliedTotal,
      percentage: grandTotal > 0 ? Math.round((r.count / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => {
      const aQuiet = a.impliedTotal === 0;
      const bQuiet = b.impliedTotal === 0;
      return aQuiet === bQuiet ? b.percentage - a.percentage : Number(aQuiet) - Number(bQuiet);
    });
}

// "Observations" rather than a noun guessed from the metric name (e.g. "requests"): Prometheus's own
// docs use this term for what a histogram measures, and it's correct regardless of domain, whereas
// guessing a domain noun risks a confidently-wrong label (e.g. "requests" for a connection-pool metric).
// Exported for unit testing.
export function getHistogramValueTooltip(
  item: AttributeValueCount,
  histogramRange: HistogramRange,
  unit: string | null
): string | undefined {
  if (item.impliedTotal === undefined) {
    return undefined;
  }
  // Sorted to the bottom of its label by processFractionResponse; this is why, not just that it's 0%.
  if (item.impliedTotal === 0) {
    return t('attribute-explorer.value-tooltip-histogram-no-activity', 'No activity in this window.');
  }
  return t(
    'attribute-explorer.value-tooltip-histogram',
    '{{count}} ({{percentage}}%) of the ~{{total}} observations are {{range}}.',
    {
      count: item.count,
      percentage: item.percentage,
      range: formatHistogramRangeLabel(histogramRange, unit),
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
    // count(), not rate(): a cheaper existence check that only needs 1 raw sample, so a value with a
    // live series but too few samples in a narrow window for rate() to compute still shows up (see
    // processFractionResponse) instead of looking indistinguishable from a genuinely-gone series. The
    // +Inf bucket exists on every classic histogram series exactly once, so this counts each series
    // once regardless of how many finite le buckets it has.
    const presenceQuery = `count by (${field}) (${applyFiltersToSelector(selector, [{ field: 'le', operator: '=', value: '+Inf' }])})`;

    return forkJoin([
      runRangeQuery(context, fractionQuery, window),
      runRangeQuery(context, totalCountQuery, window),
      runRangeQuery(context, presenceQuery, window),
    ]).pipe(
      map(([fraction, totalCount, presence]) => processFractionResponse(fraction, totalCount, presence, field, window.stepSeconds))
    );
  }

  // metricType === 'native-histogram': the only other value PrometheusAttributeExplorerProps accepts.
  const range = context.histogramRange ?? DEFAULT_HISTOGRAM_RANGE;
  // No le: a native histogram's bucket structure is internal to the sample type, not a label to
  // group by. histogram_count() is called directly on this same vector, no sibling-metric swap:
  // unlike a classic bucket vector, this vector already carries native-histogram-typed samples,
  // which is what histogram_count() requires.
  const innerVector = `sum by (${field}) (rate(${selector}[${window.stepSeconds}s]))`;
  const fractionQuery = `histogram_fraction(${formatPromQLBound(range.lowerSeconds)}, ${formatPromQLBound(range.upperSeconds)}, ${innerVector})`;
  const totalCountQuery = `histogram_count(${innerVector})`;
  // No _bucket/_count sibling swap or le matcher needed here: the raw series itself is what to count.
  const presenceQuery = `count by (${field}) (${selector})`;

  return forkJoin([
    runRangeQuery(context, fractionQuery, window),
    runRangeQuery(context, totalCountQuery, window),
    runRangeQuery(context, presenceQuery, window),
  ]).pipe(
    map(([fraction, totalCount, presence]) => processFractionResponse(fraction, totalCount, presence, field, window.stepSeconds))
  );
}

// Returns undefined, not 0 or a NaN-derived value, when there's nothing to seed from (no traffic in
// the window, a genuinely 0 median, or a non-finite sample): a 0 or invalid threshold would exclude
// or include everything, which isn't a usable starting point, so the caller falls back to
// DEFAULT_HISTOGRAM_RANGE instead. Exported for unit testing.
export function parseDefaultLowerThreshold(response: PrometheusRangeQueryResult | undefined): number | undefined {
  const series = response?.result?.[0];
  const lastSample = series?.values?.[series.values.length - 1];
  const value = Number(lastSample?.[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

// Seeds a starting lower threshold scaled to what this metric actually reports, rather than
// DEFAULT_HISTOGRAM_RANGE's fixed 1, which is meaningless for a metric whose whole distribution lives
// in milliseconds or nanoseconds (a "_seconds"-suffixed metric is still expressed as a plain float in
// seconds regardless of how small its typical values are, so a threshold of 1 excludes literally
// everything for such a metric). histogram_quantile is the one PromQL function that works identically
// across a classic bucket vector and a native histogram sample, so it's the only type-uniform way to
// derive a representative value for both without a separate code path per type.
//
// p90, not the median: this is deliberately a high percentile, not a "typical value." A threshold
// exists to highlight unusually large observations, which is a tail question, not a central-tendency
// one. The median is also structurally fragile here in a way p90 isn't: this seed runs over the WHOLE
// metric with no field grouping, so one label value that dominates total volume and clusters near zero
// (e.g. a high-traffic method whose requests carry no payload) can drag the overall median down to a
// value that falls inside the lowest bucket's interpolation range, producing a seed close to 0 that
// then reads as "almost all traffic, on every label value" once fed through histogram_fraction,
// regardless of what that label value's real observations look like. A dominant near-zero label would
// need to represent over 90% of total volume to pull p90 down the same way, which is a much narrower
// failure case than the median's over-50%.
export function fetchDefaultLowerThreshold(context: DatasetContext): Observable<number | undefined> {
  const window = getRangeQueryWindow(context);
  const innerVector =
    context.metricType === 'classic-histogram'
      ? `sum by (le) (rate(${context.query}[${window.stepSeconds}s]))`
      : `sum(rate(${context.query}[${window.stepSeconds}s]))`;
  const query = `histogram_quantile(0.9, ${innerVector})`;

  return runRangeQuery(context, query, window).pipe(map(parseDefaultLowerThreshold));
}

// unit is the field's own value (e.g. "seconds", "bytes"), not a fixed "s" suffix: the range field
// names (lowerSeconds/upperSeconds) date from when this was seconds-only, but the metric behind them
// can be any histogram unit, and hardcoding "s" produced a genuinely wrong label like "over 2s" for a
// bytes histogram, reading as "2 seconds" rather than "2 bytes". Falls back to a bare number with no
// unit word when the unit can't be determined, rather than guessing.
function formatHistogramRangeLabel(range: HistogramRange, unit: string | null): string {
  const { lowerSeconds, upperSeconds } = range;
  const withUnit = (value: number) => (unit ? `${value} ${unit}` : String(value));

  if (upperSeconds === Number.POSITIVE_INFINITY) {
    return t('attribute-explorer.histogram-range-over', 'over {{value}}', { value: withUnit(lowerSeconds) });
  }
  if (lowerSeconds === Number.NEGATIVE_INFINITY || lowerSeconds === 0) {
    return t('attribute-explorer.histogram-range-under', 'under {{value}}', { value: withUnit(upperSeconds) });
  }
  return t('attribute-explorer.histogram-range-between', 'between {{lower}} and {{upper}}', {
    lower: withUnit(lowerSeconds),
    upper: withUnit(upperSeconds),
  });
}

// Explains what the percentages mean. Unconditional now: this component only ever handles the two
// histogram types (see HistogramMetricType), so there's no longer a per-type branch to pick between.
function getAttributeExplorerDescription(histogramRange: HistogramRange, unit: string | null): string {
  return t(
    'attribute-explorer.description-histogram',
    'This shows each value\'s share of the label\'s observations {{range}}. Values with no activity are sorted last.',
    { range: formatHistogramRangeLabel(histogramRange, unit) }
  );
}

interface AttributeExplorerHeaderProps {
  histogramRange: HistogramRange;
  onHistogramRangeChange: (range: HistogramRange) => void;
  queryLimitLabel?: string;
  unit: string | null;
}

function AttributeExplorerHeader({
  histogramRange,
  onHistogramRangeChange,
  queryLimitLabel,
  unit,
}: Readonly<AttributeExplorerHeaderProps>) {
  const styles = useStyles2(getHeaderStyles);

  const [lowerText, setLowerText] = useState(String(histogramRange.lowerSeconds));
  const [upperText, setUpperText] = useState(
    histogramRange.upperSeconds === Number.POSITIVE_INFINITY ? '' : String(histogramRange.upperSeconds)
  );

  // Tracks the last range this component itself committed, so the effect below can tell "the range
  // changed because our own debounced commit landed" (already reflected in lowerText/upperText, no
  // resync needed) apart from "the range changed some other way" (the async default-threshold seed
  // resolving after this component already mounted with DEFAULT_HISTOGRAM_RANGE's placeholder, or an
  // external reset), which is the only case that needs the text inputs pulled forward to match.
  const lastCommittedRef = useRef(histogramRange);
  useEffect(() => {
    const isOwnCommit =
      lastCommittedRef.current.lowerSeconds === histogramRange.lowerSeconds &&
      lastCommittedRef.current.upperSeconds === histogramRange.upperSeconds;
    if (!isOwnCommit) {
      setLowerText(String(histogramRange.lowerSeconds));
      setUpperText(histogramRange.upperSeconds === Number.POSITIVE_INFINITY ? '' : String(histogramRange.upperSeconds));
    }
    lastCommittedRef.current = histogramRange;
  }, [histogramRange]);

  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(commitTimeoutRef.current), []);

  // Debounced: each commit triggers a full re-detection cycle in AttributeDistribution (it re-fetches
  // attributes and re-queries every currently-visible field, not just the histogram range), so typing
  // a multi-digit value without debouncing fires that whole cycle once per character.
  const commitRange = (next: Partial<HistogramRange>) => {
    clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = setTimeout(() => {
      onHistogramRangeChange({ ...histogramRange, ...next });
    }, 500);
  };

  const handleLowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.currentTarget.value;
    setLowerText(text);
    const parsed = Number(text);
    if (text.trim() !== '' && !isNaN(parsed)) {
      commitRange({ lowerSeconds: parsed });
    }
  };

  const handleUpperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.currentTarget.value;
    setUpperText(text);
    if (text.trim() === '') {
      commitRange({ upperSeconds: Number.POSITIVE_INFINITY });
      return;
    }
    const parsed = Number(text);
    if (!isNaN(parsed)) {
      commitRange({ upperSeconds: parsed });
    }
  };

  return (
    <div className={styles.header}>
      <div className={styles.title}>
        {t('attribute-explorer.title', 'Attribute Explorer')}
        <Tooltip interactive content={getAttributeExplorerDescription(histogramRange, unit)}>
          <Icon name="info-circle" size="sm" />
        </Tooltip>
      </div>
      {queryLimitLabel && <div className={styles.queryLimit}>{queryLimitLabel}</div>}
      <div className={styles.thresholdInputs}>
        <Field
          label={
            unit
              ? t('attribute-explorer.lower-limit-unit', 'Lower limit ({{unit}})', { unit })
              : t('attribute-explorer.lower-limit', 'Lower limit')
          }
        >
          <Input
            type="number"
            width={12}
            value={lowerText}
            onChange={handleLowerChange}
            data-testid="histogram-lower-limit-input"
          />
        </Field>
        <Field
          label={
            unit
              ? t('attribute-explorer.upper-limit-unit', 'Upper limit ({{unit}})', { unit })
              : t('attribute-explorer.upper-limit', 'Upper limit')
          }
        >
          <Input
            type="number"
            width={12}
            placeholder={t('attribute-explorer.upper-limit-placeholder', 'no limit')}
            value={upperText}
            onChange={handleUpperChange}
            data-testid="histogram-upper-limit-input"
          />
        </Field>
      </div>
      {!unit && (
        <div className={styles.warning}>
          {t(
            'attribute-explorer.unit-unknown',
            "We couldn't determine this metric's unit from its name. Double-check the threshold before trusting the percentage."
          )}
        </div>
      )}
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
    thresholdInputs: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
    warning: css({
      color: theme.colors.warning.text,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}

export interface PrometheusAttributeExplorerProps {
  attributeKinds?: Record<string, 'metric' | 'resource'>;
  attributeLabels?: Record<string, string>;
  colorBars?: boolean;
  datasourceUid: string;
  histogramRange?: HistogramRange;
  metric: string;
  metricType: HistogramMetricType;
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  onHistogramRangeChange: (range: HistogramRange) => void;
  priorityAttributes?: string[];
  query: string;
  queryLimitLabel?: string;
  selectedFilters?: ActiveFilter[];
  timeRange: TimeRange;
}

export function PrometheusAttributeExplorer({
  attributeKinds,
  attributeLabels,
  colorBars,
  datasourceUid,
  histogramRange,
  metric,
  metricType,
  selectedFilters,
  onFiltersChange,
  onHistogramRangeChange,
  priorityAttributes,
  query,
  queryLimitLabel,
  timeRange,
}: Readonly<PrometheusAttributeExplorerProps>) {
  const numericTimeRange = useMemo(() => ({ from: timeRange.from.valueOf(), to: timeRange.to.valueOf() }), [timeRange]);
  const resolvedHistogramRange = histogramRange ?? DEFAULT_HISTOGRAM_RANGE;
  const unit = getUnitFromMetric(metric);

  const context: DatasetContext = useMemo(
    () => ({ datasourceUid, histogramRange: resolvedHistogramRange, metricType, query, timeRange: numericTimeRange }),
    [datasourceUid, resolvedHistogramRange, metricType, query, numericTimeRange]
  );

  const getValueTooltip = (item: AttributeValueCount) => getHistogramValueTooltip(item, resolvedHistogramRange, unit);

  const getAttributeBadge = (attribute: string): string | undefined => {
    switch (attributeKinds?.[attribute]) {
      case 'metric':
        return t('attribute-explorer.badge-metric', 'OTel metric attribute');
      case 'resource':
        return t('attribute-explorer.badge-resource', 'OTel resource attribute');
      default:
        return undefined;
    }
  };

  return (
    <AttributeDistribution
      attributeLabels={attributeLabels}
      colorBars={colorBars}
      context={context}
      fetchAttributes={fetchAttributes}
      fetchDistribution={fetchDistribution}
      getAttributeBadge={getAttributeBadge}
      getValueTooltip={getValueTooltip}
      header={
        <AttributeExplorerHeader
          histogramRange={resolvedHistogramRange}
          onHistogramRangeChange={onHistogramRangeChange}
          queryLimitLabel={queryLimitLabel}
          unit={unit}
        />
      }
      onFiltersChange={onFiltersChange}
      priorityAttributes={priorityAttributes}
      selectedFilters={selectedFilters}
    />
  );
}
