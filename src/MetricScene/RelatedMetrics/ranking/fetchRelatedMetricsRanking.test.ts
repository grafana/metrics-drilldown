import { getBackendSrv } from '@grafana/runtime';

import { fetchRelatedMetricsRanking, parseRankingResponse } from './fetchRelatedMetricsRanking';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
}));

const request = { schemaVersion: 1 as const, selected: { name: 'selected' }, candidates: [{ id: 'c01', name: 'candidate', baselineRank: 1 }] };

describe('related metrics ranking response handling', () => {
  it('ignores unknown ids while preserving optional response fields', () => {
    const parsed = parseRankingResponse({
      status: 'ok',
      recommended: [{ id: 'c01', p: 0.8 }, { id: 'c99', p: 1 }],
      scores: { c01: 0.8, c99: 1 },
      relationships: { c01: { class: 'same_signal_family', confidence: 0.9 }, c99: { class: 'unrelated' } },
      usage: { inputTokens: 2 },
      ignored: true,
    }, ['c01']);

    expect(parsed).toMatchObject({ recommended: [{ id: 'c01', p: 0.8 }], scores: { c01: 0.8 }, relationships: { c01: { class: 'same_signal_family' } } });
  });

  it('fails open for non-ok responses', async () => {
    jest.mocked(getBackendSrv).mockReturnValue({ fetch: jest.fn().mockReturnValue({ subscribe: (observer: any) => { observer.next({ ok: true, status: 200, data: { status: 'timeout' } }); observer.complete(); } }) } as any);
    await expect(fetchRelatedMetricsRanking(request, ['c01'])).resolves.toMatchObject({ ok: false, reason: 'not-ok' });
  });

  it('fails open when the request times out', async () => {
    jest.useFakeTimers();
    jest.mocked(getBackendSrv).mockReturnValue({ fetch: jest.fn().mockReturnValue({ subscribe: () => undefined }) } as any);
    const result = fetchRelatedMetricsRanking(request, ['c01']);
    jest.advanceTimersByTime(5001);
    await expect(result).resolves.toMatchObject({ ok: false });
    jest.useRealTimers();
  });
});
