import { applyRanking } from './applyRanking';
import { type RankingCandidateInfo, type RelatedMetricsRankingResponse } from './types';

const baseline = [
  'selected_metric',
  'demo_requests_total',
  'demo_errors_total',
  'demo_latency_seconds',
  'other_metric',
];
const candidates: RankingCandidateInfo[] = baseline.slice(1, 4).map((name, index) => ({
  id: `c${index}`,
  name,
  baselineRank: index + 1,
}));
const response: RelatedMetricsRankingResponse = {
  status: 'ok',
  recommended: [
    { id: 'c2', p: 0.7 },
    { id: 'c0', p: 0.2 },
  ],
  scores: { c0: 0.2, c1: 0.1, c2: 0.7 },
  relationships: {},
};

describe('applyRanking', () => {
  it('orders candidates by score then appends unranked metrics in baseline order without mutating inputs', () => {
    expect(applyRanking(baseline, candidates, response)).toEqual([
      'demo_latency_seconds',
      'demo_requests_total',
      'demo_errors_total',
      'selected_metric',
      'other_metric',
    ]);
    expect(baseline[0]).toBe('selected_metric');
  });

  it('promotes recommendations even when the server does not supply the full score map', () => {
    expect(applyRanking(baseline, candidates, { ...response, scores: undefined })).toEqual([
      'demo_latency_seconds',
      'demo_requests_total',
      'selected_metric',
      'demo_errors_total',
      'other_metric',
    ]);
  });

  it('uses server recommendation order when probabilities are omitted', () => {
    expect(
      applyRanking(baseline, candidates, {
        ...response,
        scores: undefined,
        recommended: [{ id: 'c2' }, { id: 'c0' }],
      })
    ).toEqual(['demo_latency_seconds', 'demo_requests_total', 'selected_metric', 'demo_errors_total', 'other_metric']);
  });

  it('does not reintroduce filtered metrics or unknown candidate IDs', () => {
    expect(
      applyRanking(['demo_errors_total', 'other_metric'], candidates, {
        ...response,
        scores: { ...response.scores, unknown: 1 },
      })
    ).toEqual(['demo_errors_total', 'other_metric']);
  });

  it('preserves baseline order for equal scores', () => {
    expect(
      applyRanking(baseline, candidates, {
        ...response,
        recommended: [],
        scores: { c0: 0.5, c1: 0.5, c2: 0.5 },
      })
    ).toEqual([...baseline.slice(1, 4), 'selected_metric', 'other_metric']);
  });

  it('falls back to the unchanged baseline for missing, failed, or empty rankings', () => {
    expect(applyRanking(baseline, candidates)).toEqual(baseline);
    expect(applyRanking(baseline, candidates, { ...response, status: 'timeout' })).toEqual(baseline);
    expect(applyRanking(baseline, candidates, { status: 'ok', recommended: [], relationships: {} })).toEqual(baseline);
  });
});
