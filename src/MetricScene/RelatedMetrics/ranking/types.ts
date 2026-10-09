export type RankingMetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'native-histogram' | 'info' | 'unknown';

export interface RankingMetric {
  name: string;
  type?: RankingMetricType;
  unit?: string;
  help?: string;
  labelNames?: string[];
}

export interface RankingCandidate extends RankingMetric {
  id: string;
  baselineRank: number;
}

export interface RelatedMetricsRankingRequest {
  schemaVersion: 1;
  datasourceUid?: string;
  selected: RankingMetric;
  candidates: RankingCandidate[];
}

export interface RecommendedMetric {
  id: string;
  p?: number;
}

export interface Relationship {
  class?: 'same_signal_family' | 'investigative_companion' | 'weakly_related' | 'unrelated';
  confidence?: number;
  probabilities?: Record<string, number>;
}

export interface RankingUsage {
  inputTokens?: number;
  cost?: number;
}

export type RankingStatus = 'ok' | 'low_confidence' | 'invalid' | 'upstream_error' | 'timeout' | 'disabled';

export interface RelatedMetricsRankingResponse {
  status: RankingStatus;
  model?: string;
  promptVersion?: string;
  cached?: boolean;
  latencyMs?: number;
  recommended: RecommendedMetric[];
  scores?: Record<string, number>;
  relationships: Record<string, Relationship>;
  usage?: RankingUsage;
  fallbackReason?: string;
}

export type RankingResult =
  | { ok: true; response: RelatedMetricsRankingResponse; latencyMs: number }
  | { ok: false; reason: 'disabled' | 'timeout' | 'network' | 'http' | 'invalid-response' | 'not-ok' };

export interface RankingCandidateInfo extends RankingCandidate {
  score?: number;
  relationship?: Relationship;
}
