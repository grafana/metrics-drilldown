import { getBackendSrv } from '@grafana/runtime';
import { of, Subject, throwError } from 'rxjs';

import { fetchRelatedMetricsRanking, parseRankingResponse } from './fetchRelatedMetricsRanking';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
}));

const request = {
  schemaVersion: 1 as const,
  selected: { name: 'selected' },
  candidates: [{ id: 'c01', name: 'candidate', baselineRank: 1 }],
};

function mockFetch(fetch: jest.Mock) {
  jest.mocked(getBackendSrv).mockReturnValue({ fetch } as any);
  return fetch;
}

describe('parseRankingResponse', () => {
  it('ignores unknown ids and fields while preserving optional response fields', () => {
    const parsed = parseRankingResponse(
      {
        status: 'ok',
        recommended: [
          { id: 'c01', p: 0.8 },
          { id: 'c99', p: 1 },
        ],
        scores: { c01: 0.8, c99: 1 },
        relationships: { c01: { class: 'same_signal_family', confidence: 0.9 }, c99: { class: 'unrelated' } },
        usage: { inputTokens: 2 },
        ignored: true,
      },
      ['c01']
    );

    expect(parsed).toMatchObject({
      recommended: [{ id: 'c01', p: 0.8 }],
      scores: { c01: 0.8 },
      relationships: { c01: { class: 'same_signal_family' } },
      usage: { inputTokens: 2 },
    });
    expect(parsed).not.toHaveProperty('ignored');
  });

  it('accepts the minimal stub response', () => {
    expect(
      parseRankingResponse(
        {
          status: 'ok',
          model: 'stub',
          promptVersion: 'stub-v0',
          cached: false,
          latencyMs: 0,
          recommended: [{ id: 'c01', p: 0.5 }],
          relationships: {},
        },
        ['c01']
      )
    ).toMatchObject({ status: 'ok', recommended: [{ id: 'c01', p: 0.5 }], relationships: {} });
  });

  it('rejects unknown statuses and non-objects', () => {
    expect(parseRankingResponse({ status: 'great' }, ['c01'])).toBeUndefined();
    expect(parseRankingResponse('ok', ['c01'])).toBeUndefined();
  });
});

describe('fetchRelatedMetricsRanking', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('posts the request to the asserts resource path with an abort signal and no error alerts', async () => {
    const fetch = mockFetch(
      jest
        .fn()
        .mockReturnValue(of({ ok: true, status: 200, data: { status: 'ok', recommended: [{ id: 'c01', p: 0.9 }] } }))
    );

    await expect(fetchRelatedMetricsRanking(request, ['c01'])).resolves.toMatchObject({
      ok: true,
      response: { recommended: [{ id: 'c01', p: 0.9 }] },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/plugins/grafana-asserts-app/resources/jev/v1/related-metrics/rank',
        method: 'POST',
        data: request,
        showErrorAlert: false,
        abortSignal: expect.any(AbortSignal),
      })
    );
  });

  it('fails open for non-ok statuses but keeps the payload for debugging', async () => {
    mockFetch(jest.fn().mockReturnValue(of({ ok: true, status: 200, data: { status: 'disabled', recommended: [] } })));

    await expect(fetchRelatedMetricsRanking(request, ['c01'])).resolves.toMatchObject({
      ok: false,
      reason: 'not-ok',
      response: { status: 'disabled' },
    });
  });

  it('fails open for rejected HTTP responses, keeping a parseable server payload', async () => {
    mockFetch(
      jest.fn().mockReturnValue(throwError(() => ({ status: 400, data: { status: 'invalid', fallbackReason: 'bad' } })))
    );

    await expect(fetchRelatedMetricsRanking(request, ['c01'])).resolves.toMatchObject({
      ok: false,
      reason: 'http',
      response: { status: 'invalid', fallbackReason: 'bad' },
    });
  });

  it('fails open on network errors without a payload', async () => {
    mockFetch(jest.fn().mockReturnValue(throwError(() => new Error('offline'))));

    await expect(fetchRelatedMetricsRanking(request, ['c01'])).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('fails open when the request times out', async () => {
    jest.useFakeTimers();
    mockFetch(jest.fn().mockReturnValue(new Subject()));

    const result = fetchRelatedMetricsRanking(request, ['c01']);
    jest.advanceTimersByTime(5001);

    await expect(result).resolves.toEqual({ ok: false, reason: 'timeout' });
  });

  it('settles promptly when the caller aborts', async () => {
    const fetch = mockFetch(jest.fn().mockReturnValue(new Subject()));
    const controller = new AbortController();

    const result = fetchRelatedMetricsRanking(request, ['c01'], controller.signal);
    controller.abort();

    await expect(result).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect(fetch.mock.calls[0][0].abortSignal.aborted).toBe(true);
  });
});
