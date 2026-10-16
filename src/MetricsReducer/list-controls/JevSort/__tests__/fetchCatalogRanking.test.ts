import { getBackendSrv } from '@grafana/runtime';
import { NEVER, of } from 'rxjs';

import { CATALOG_RANK_URL, fetchCatalogRanking, parseCatalogResponse } from '../fetchCatalogRanking';
import { type CatalogRequest } from '../ranking';

jest.mock('@grafana/runtime');
const request: CatalogRequest = {
  schemaVersion: 1,
  datasourceUid: 'synthetic-prom',
  candidates: [{ id: 'c01', name: 'http_requests_total', baselineRank: 1 }],
};
const raw = () => ({
  status: 'partial',
  scores: {
    c01: { utility: 99, probabilities: { high_value: 0.75, supporting: 0.2, low_value: 0.04, unknown: 0.01 } },
    foreign: { utility: 1 },
  },
});

it('validates the rubric, ignores foreign IDs, and recomputes utility', () => {
  const parsed = parseCatalogResponse(raw(), request)!;
  expect(Object.keys(parsed.scores)).toEqual(['c01']);
  expect(parsed.scores.c01.utility).toBeCloseTo(0.85);
  expect(parseCatalogResponse({ ...raw(), status: 'invented' }, request)).toBeUndefined();
  expect(parseCatalogResponse({ ...raw(), scores: [] }, request)).toBeUndefined();
});

it('maps actual provider token usage and ignores invalid accounting values', () => {
  expect(parseCatalogResponse({ ...raw(), usage: { input_tokens: 12144, cost: 0.00051 } }, request)?.usage).toEqual({
    inputTokens: 12144,
    cost: 0.00051,
  });
  expect(parseCatalogResponse({ ...raw(), usage: { input_tokens: -1, cost: Infinity } }, request)?.usage).toEqual({});
});

it('posts only the companion contract using Grafana abortSignal and suppresses toast alerts', async () => {
  const fetch = jest.fn().mockReturnValue(of({ ok: true, status: 200, data: raw() }));
  jest.mocked(getBackendSrv).mockReturnValue({ fetch } as never);
  const controller = new AbortController();
  const result = await fetchCatalogRanking(request, controller.signal);
  expect(result.status).toBe('partial');
  expect(fetch).toHaveBeenCalledWith(
    expect.objectContaining({
      url: CATALOG_RANK_URL,
      method: 'POST',
      data: request,
      abortSignal: expect.any(AbortSignal),
      showErrorAlert: false,
    })
  );
});

it('settles immediately when cancelled even if the transport does not', async () => {
  jest.useFakeTimers();
  try {
    const fetch = jest.fn().mockReturnValue(NEVER);
    jest.mocked(getBackendSrv).mockReturnValue({ fetch } as never);
    const controller = new AbortController();
    const promise = fetchCatalogRanking(request, controller.signal);
    const cancelled = promise.catch((error) => error);
    controller.abort();
    expect(await cancelled).toMatchObject({ message: expect.stringContaining('cancelled') });
    const timeout = fetchCatalogRanking(request, new AbortController().signal).catch((error) => error);
    await jest.advanceTimersByTimeAsync(5000);
    expect(await timeout).toMatchObject({ message: expect.stringContaining('timed out') });
  } finally {
    jest.useRealTimers();
  }
});
