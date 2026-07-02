import { type TimeRange } from '@grafana/data';

import {
  MetricDatasourceHelper,
  type PrometheusRuntimeDatasource,
} from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';

import { type BinaryLeaf, type BinaryRatio, type BinarySide } from './parseBinaryQuery';

/**
 * Label discovery for a binary ratio: the labels you can break the ratio down by are the labels
 * present on BOTH operands, because `sum by(L)(left) <op> sum by(L)(right)` only yields series
 * where `L` exists on each side.
 *
 * Renders one matcher per operand leaf, fetches its label names via the existing version-gated
 * `MetricDatasourceHelper.fetchLabels` (the same in-scene path `LabelsDataSource` uses), intersects
 * within each side and then across the two sides, and drops internal labels.
 *
 * `asserts_*` filtering is intentionally NOT done here: it is context-dependent (kept for asserts
 * metrics, stripped otherwise) and already handled by `FilterGroupByAssertsLabelsBehavior` on the
 * `GroupByOptionsLoadedEvent`, which step 3 preserves. Active page filters are likewise not folded
 * in yet; scope is each operand's own matchers.
 */

interface DiscoverBreakdownLabelsOptions {
  ratio: BinaryRatio;
  ds: PrometheusRuntimeDatasource;
  timeRange: TimeRange;
}

/**
 * `{__name__="<metric>", <label><op>"<value>", ...}` — the `__name__` form so colon names are legal.
 *
 * The metric name comes from a bare identifier (`leaf.metricName`) or, when absent, from a `__name__`
 * matcher (any operator, e.g. `=`, `=~`); emit a single `__name__` matcher, never duplicated.
 *
 * Values are emitted verbatim. `parseBinaryQuery` returns them as the raw slice between the source
 * literal's quotes, i.e. already in PromQL double-quote-escaped form (a regex `\.json$` stays `\.json$`).
 * Re-escaping here would double-escape backslashes/quotes and change matcher meaning.
 */
export function renderLeafMatcher(leaf: BinaryLeaf): string {
  const nameMatcher = leaf.labels.find((m) => m.label === '__name__');

  const parts: string[] = [];
  if (leaf.metricName) {
    parts.push(`__name__="${leaf.metricName}"`);
  } else if (nameMatcher) {
    // Preserve the operator so `{__name__=~"..."}` / `{__name__!="..."}` keep their metric constraint
    // instead of collapsing to an unconstrained `{}` that over-queries.
    parts.push(`__name__${nameMatcher.op}"${nameMatcher.value}"`);
  }
  for (const { label, op, value } of leaf.labels) {
    if (label === '__name__') {
      continue;
    }
    parts.push(`${label}${op}"${value}"`);
  }
  return `{${parts.join(', ')}}`;
}

function intersectSets(sets: Array<Set<string>>): Set<string> {
  if (sets.length === 0) {
    return new Set();
  }
  const [first, ...rest] = sets;
  return rest.reduce((acc, set) => new Set([...acc].filter((name) => set.has(name))), new Set(first));
}

async function sideLabelNames(
  side: BinarySide,
  ds: PrometheusRuntimeDatasource,
  timeRange: TimeRange
): Promise<Set<string>> {
  if (side.leaves.length === 0) {
    return new Set();
  }
  const perLeaf = await Promise.all(
    side.leaves.map((leaf) =>
      MetricDatasourceHelper.fetchLabels({ ds, timeRange, matcher: renderLeafMatcher(leaf) })
    )
  );
  // A label is groupable for this side only if it exists on every leaf of the side.
  return intersectSets(perLeaf.map((names) => new Set(names)));
}

function isReserved(name: string): boolean {
  return name.startsWith('__') || name === 'le';
}

export async function discoverBreakdownLabels({
  ratio,
  ds,
  timeRange,
}: DiscoverBreakdownLabelsOptions): Promise<string[]> {
  const [left, right] = await Promise.all([
    sideLabelNames(ratio.left, ds, timeRange),
    sideLabelNames(ratio.right, ds, timeRange),
  ]);

  const intersected = [...left].filter((name) => right.has(name) && !isReserved(name));
  return Array.from(new Set(intersected)).sort((a, b) => a.localeCompare(b));
}
