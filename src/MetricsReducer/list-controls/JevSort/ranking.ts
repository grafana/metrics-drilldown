import {
  isValidMetricName,
  metricFeatures,
  type MetadataPeek,
} from 'MetricScene/RelatedMetrics/ranking/buildRankingRequest';
import { type RankingMetric, type RankingUsage } from 'MetricScene/RelatedMetrics/ranking/types';

import { BOOKMARK_BOOST, MAX_HISTORY_BOOST, MAX_PERSONAL_BOOST, type PersonalSignals } from './personalization';

export const CATALOG_POLICY_VERSION = 'catalog-rubric-v2-personal';
export type OtelEvidence = 'scope-labels' | 'semantic-convention' | 'unknown';
export type Rubric = 'high_value' | 'supporting' | 'low_value' | 'unknown';
export type Probabilities = Record<Rubric, number>;
export interface CatalogScore {
  utility: number;
  probabilities: Probabilities;
}
export interface CatalogCandidate extends RankingMetric {
  id: string;
  baselineRank: number;
  otelEvidence?: OtelEvidence;
}
export interface CatalogRequest {
  schemaVersion: 1;
  datasourceUid?: string;
  candidates: CatalogCandidate[];
}
export interface CatalogResponse {
  status: 'ok' | 'partial' | 'low_confidence' | 'upstream_error' | 'timeout' | 'disabled' | 'invalid';
  scores: Record<string, CatalogScore>;
  model?: string;
  promptVersion?: string;
  cached?: boolean;
  latencyMs?: number;
  usage?: RankingUsage;
  fallbackReason?: string;
}
export interface LocalSignals {
  trackedMetrics: Map<string, Set<string>>;
  activeBurnMetrics: Set<string>;
  /** Only populate when datasource attribution is proven. Never use org-wide ruler name counts. */
  attributedFiringCounts: Map<string, number>;
  dashboardCounts?: Record<string, number>;
  alertCounts?: Record<string, number>;
  personal?: PersonalSignals;
}
export interface LocalCandidate extends RankingMetric {
  band: 0 | 1 | 2;
  baselineRank: number;
  localScore: number;
  personalBoost: number;
  reasons: string[];
  otelEvidence: OtelEvidence;
}

// Explicit translated semconv instruments, not a general http_ or service_name provenance guess.
const SEMCONV = new Set([
  'http_server_request_duration',
  'http_client_request_duration',
  'http_server_request_body_size',
  'http_client_request_body_size',
  'rpc_server_duration',
  'rpc_client_duration',
  'rpc_server_request_duration',
  'rpc_client_request_duration',
  'db_client_operation_duration',
  'db_client_connections_usage',
  'db_client_connection_count',
  'messaging_client_operation_duration',
  'messaging_process_duration',
  'process_cpu_time',
  'process_memory_usage',
  'jvm_memory_used',
  'jvm_gc_duration',
  'go_memory_used',
  'go_goroutine_count',
]);
const SCOPE_LABELS = new Set(['otel_scope_name', 'otel_scope_version', 'otel_scope_schema_url']);
const BOOKKEEPING = /(?:^|_)(?:info|created|version)$/;
const ACTIONABLE =
  /(?:^|[_:])(?:errors?|failures?|duration|latency|requests?|saturation|utilization|queue|capacity)(?:[_:]|$)/;

export function otelEvidence(name: string, labels: string[] = []): OtelEvidence {
  if (labels.some((label) => SCOPE_LABELS.has(label))) {
    return 'scope-labels';
  }
  let translated = name;
  while (!SEMCONV.has(translated)) {
    const stripped = translated.replace(/_(?:seconds|bytes|total|bucket|sum|count)$/, '');
    if (stripped === translated) {
      return 'unknown';
    }
    translated = stripped;
  }
  return 'semantic-convention';
}

function priorityBand(burn: boolean, firing: number, tracked: boolean): 0 | 1 | 2 {
  if (burn || firing > 0) {
    return 0;
  }
  return tracked ? 1 : 2;
}

export function buildLocalBaseline(names: string[], signals: LocalSignals, peek: MetadataPeek): LocalCandidate[] {
  const bookmarks = new Set(signals.personal?.bookmarks ?? []);
  return [...new Set(names)]
    .map((name, index): LocalCandidate => {
      const burn = signals.activeBurnMetrics.has(name);
      const firing = signals.attributedFiringCounts.get(name) ?? 0;
      const tracked = signals.trackedMetrics.has(name);
      const evidence = otelEvidence(name);
      const actionable = ACTIONABLE.test(name) && !BOOKKEEPING.test(name);
      const rawHistory = signals.personal?.historyBoosts[name];
      const historyBoost =
        typeof rawHistory === 'number' && Number.isFinite(rawHistory)
          ? Math.max(0, Math.min(rawHistory, MAX_HISTORY_BOOST))
          : 0;
      const personalBoost = Math.min(MAX_PERSONAL_BOOST, historyBoost + Number(bookmarks.has(name)) * BOOKMARK_BOOST);
      const reasons = [
        burn && 'active-slo-burn',
        firing > 0 && 'attributed-firing',
        tracked && 'slo-tracked',
        actionable && 'health-signal',
        evidence !== 'unknown' && evidence,
        historyBoost > 0 && 'personal-visit-history',
        bookmarks.has(name) && 'bookmarked',
      ].filter((reason): reason is string => Boolean(reason));
      return {
        ...metricFeatures(name, peek),
        baselineRank: index + 1,
        band: priorityBand(burn, firing, tracked),
        otelEvidence: evidence,
        personalBoost,
        localScore:
          Number(burn) * 20 +
          Math.min(firing, 5) * 2 +
          Number(actionable) * 4 +
          Number(evidence !== 'unknown' && !BOOKKEEPING.test(name)) * 2 +
          Math.min(signals.dashboardCounts?.[name] ?? 0, 3) +
          Math.min(signals.alertCounts?.[name] ?? 0, 3) +
          personalBoost * 10,
        reasons,
      };
    })
    .sort((a, b) => a.band - b.band || b.localScore - a.localScore || a.baselineRank - b.baselineRank);
}

/** Histogram components share a family; recording-rule prefix variants share their source family. */
export function metricFamily(name: string): string {
  const parts = name.split(':').filter(Boolean);
  const source = parts.length > 1 ? parts[parts.length - 2] : name;
  return source.replace(/_(?:bucket|sum|count|total)$/, '');
}

function diversify(candidates: LocalCandidate[]): LocalCandidate[] {
  const families = new Map<string, LocalCandidate[]>();
  for (const candidate of candidates) {
    const key = metricFamily(candidate.name);
    const family = families.get(key) ?? [];
    family.push(candidate);
    families.set(key, family);
  }
  const ordered: LocalCandidate[] = [];
  const queue = [...families.values()].map((items) => ({ items, index: 0 }));
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const group = queue[cursor];
    ordered.push(group.items[group.index++]);
    if (group.index < group.items.length) {
      queue.push(group);
    }
  }
  return ordered;
}

export function selectCatalogCandidates(baseline: LocalCandidate[]): LocalCandidate[] {
  const bands = [0, 1, 2].map((band) =>
    diversify(baseline.filter((c) => c.band === band && isValidMetricName(c.name)))
  );
  const quotas = [20, 12, 8];
  const selected = bands.flatMap((band, index) => band.slice(0, quotas[index]));
  for (const [index, band] of bands.entries()) {
    selected.push(...band.slice(quotas[index], quotas[index] + 40 - selected.length));
    if (selected.length === 40) {
      break;
    }
  }
  const positions = new Map(baseline.map((candidate, index) => [candidate.name, index]));
  return selected.sort((a, b) => positions.get(a.name)! - positions.get(b.name)!);
}

const URL_TEXT = /\b(?:[a-z][a-z\d+.-]*:\/\/|www\.)[^\s]+/gi;
function catalogFeatures(candidate: LocalCandidate): RankingMetric {
  const features = metricFeatures(candidate.name, () => candidate, candidate.labelNames);
  if (features.help) {
    features.help = features.help.replace(URL_TEXT, '[link omitted]').slice(0, 300);
  }
  if (features.unit && features.unit.replace(URL_TEXT, '') !== features.unit) {
    delete features.unit;
  }
  return features;
}

export function catalogRequest(candidates: LocalCandidate[], datasourceUid: string): CatalogRequest {
  return {
    schemaVersion: 1,
    datasourceUid,
    candidates: candidates.map((candidate, index) => ({
      ...catalogFeatures(candidate),
      otelEvidence: candidate.otelEvidence,
      id: `c${String(index + 1).padStart(2, '0')}`,
      baselineRank: index + 1,
    })),
  };
}

export function validateCatalogScore(value: unknown): CatalogScore | undefined {
  if (!value || typeof value !== 'object' || !('probabilities' in value)) {
    return;
  }
  const probabilities = value.probabilities as Probabilities;
  const keys: Rubric[] = ['high_value', 'supporting', 'low_value', 'unknown'];
  if (
    !probabilities ||
    !keys.every(
      (key) =>
        typeof probabilities[key] === 'number' &&
        Number.isFinite(probabilities[key]) &&
        probabilities[key] >= 0 &&
        probabilities[key] <= 1
    )
  ) {
    return;
  }
  const mass = keys.reduce((sum, key) => sum + probabilities[key], 0);
  if (
    Math.abs(mass - 1) > 0.02 ||
    probabilities.unknown >= 0.5 ||
    Math.max(...keys.map((key) => probabilities[key])) < 0.5
  ) {
    return;
  }
  return { probabilities, utility: probabilities.high_value + 0.5 * probabilities.supporting };
}

export function mergeCatalogRanking(
  baseline: LocalCandidate[],
  request: CatalogRequest,
  scores: Record<string, CatalogScore>
): string[] {
  const byName = new Map(
    request.candidates.flatMap((c) => {
      const score = validateCatalogScore(scores[c.id]);
      return score ? [[c.name, score.utility] as const] : [];
    })
  );
  const positions = new Map(baseline.map((candidate, index) => [candidate.name, index]));
  return [...baseline]
    .sort((a, b) => {
      if (a.band !== b.band) {
        return a.band - b.band;
      }
      const scoreA = byName.get(a.name);
      const scoreB = byName.get(b.name);
      if (scoreA !== undefined && scoreB !== undefined) {
        return scoreB + b.personalBoost - (scoreA + a.personalBoost) || positions.get(a.name)! - positions.get(b.name)!;
      }
      return (
        Number(scoreB !== undefined) - Number(scoreA !== undefined) || positions.get(a.name)! - positions.get(b.name)!
      );
    })
    .map((candidate) => candidate.name);
}
