import { type RankingCandidateInfo, type RelatedMetricsRankingResponse } from './types';

/** Promote Jev's scored candidates, retaining baseline order for ties and unranked metrics. */
export function applyRanking(
  baseline: string[],
  candidates: RankingCandidateInfo[],
  response?: RelatedMetricsRankingResponse
): string[] {
  if (response?.status !== 'ok') {
    return baseline;
  }

  const byId = new Map(candidates.map(({ id, name }) => [id, name]));
  const available = new Set(baseline);
  const scores = new Map<string, number>();
  const recommendationOrder = new Map<string, number>();
  for (const [index, { id, p }] of response.recommended.entries()) {
    const name = byId.get(id);
    if (name && available.has(name)) {
      scores.set(name, p ?? 0);
      recommendationOrder.set(name, index);
    }
  }
  for (const [id, score] of Object.entries(response.scores ?? {})) {
    const name = byId.get(id);
    if (name && available.has(name)) {
      scores.set(name, score);
    }
  }

  // Respect recommendation order when probabilities are absent/tied; otherwise ties and
  // the unranked tail retain the baseline order.
  return [...baseline].sort((a, b) => {
    const aScore = scores.get(a);
    const bScore = scores.get(b);
    if (aScore === undefined) {
      return bScore === undefined ? 0 : 1;
    }
    if (bScore === undefined) {
      return -1;
    }
    return (
      bScore - aScore ||
      (recommendationOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (recommendationOrder.get(b) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}
