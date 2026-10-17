import { buildRankingRequest } from './buildRankingRequest';

describe('buildRankingRequest', () => {
  it('keeps deterministic baseline order, removes invalid/duplicate names, and limits candidates', async () => {
    const { request, candidatesById } = await buildRankingRequest({
      selectedMetric: 'http_requests_total',
      metricNames: [
        'bad-name',
        'http_requests_total',
        'http_requests_errors',
        'http_requests_errors',
        'http_requests_duration',
      ],
      peekMetadata: (name) =>
        name === 'http_requests_errors' ? { type: 'counter', unit: 'requests', help: 'Errors' } : undefined,
      lookupLabelNames: async (name) => (name === 'http_requests_errors' ? ['__name__', 'status', 'bad-label'] : []),
      datasourceUid: 'prom',
    });

    expect(request.schemaVersion).toBe(1);
    expect(request.datasourceUid).toBe('prom');
    expect(request.selected.name).toBe('http_requests_total');
    expect(request.candidates.map((candidate) => candidate.name)).toEqual([
      'http_requests_errors',
      'http_requests_duration',
    ]);
    expect(request.candidates[0]).toMatchObject({
      id: 'c01',
      baselineRank: 1,
      type: 'counter',
      labelNames: ['status'],
    });
    expect(candidatesById.get('c02')).toBe('http_requests_duration');
  });
});
