import { sceneGraph } from '@grafana/scenes';
import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { fetchRelatedMetricsRanking } from './fetchRelatedMetricsRanking';
import { RelatedMetricsRanking } from './RelatedMetricsRanking';

// Implementations are (re)installed in beforeEach because the repo's jest config uses resetMocks.
const helper = {
  peekMetadata: jest.fn(),
  getLabelNamesForMetric: jest.fn(),
};

let trail: {
  peekMetricMetadata: typeof helper.peekMetadata;
  getMetricLabelNames: typeof helper.getLabelNamesForMetric;
};

// Mock only getTrailFor: requiring the real module pulls in DataTrail and a circular import chain.
jest.mock('shared/utils/utils', () => ({ getTrailFor: () => trail }));

jest.mock('./fetchRelatedMetricsRanking', () => ({
  fetchRelatedMetricsRanking: jest.fn(),
}));

const METRICS = ['demo_requests_total', 'demo_errors_total', 'demo_latency_seconds_bucket', 'other_metric'];

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('RelatedMetricsRanking', () => {
  beforeEach(() => {
    localStorage.clear();
    trail = { peekMetricMetadata: helper.peekMetadata, getMetricLabelNames: helper.getLabelNamesForMetric };
    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      state: { value: { from: new Date(1), to: new Date(2) } },
    } as never);
    helper.peekMetadata.mockReturnValue(undefined);
    helper.getLabelNamesForMetric.mockResolvedValue(['job']);
  });

  it('releases label lookup slots even when a lookup throws synchronously', async () => {
    localStorage.setItem('gmd.jev.enabled', '1');
    helper.getLabelNamesForMetric.mockImplementation(() => {
      throw new Error('boom');
    });
    jest.mocked(fetchRelatedMetricsRanking).mockResolvedValue({ ok: false, reason: 'network' });
    const many = Array.from({ length: 20 }, (_, i) => `demo_metric_${i}_total`);
    const ranking = new RelatedMetricsRanking('demo_metric_0_total');

    ranking.start(many);
    await flush();

    expect(ranking.state.status).toBe('failed');
    expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(1);
  });

  it('does nothing unless explicitly enabled', async () => {
    const ranking = new RelatedMetricsRanking('demo_requests_total');
    ranking.start(METRICS);
    await flush();

    expect(ranking.state.status).toBe('hidden');
    expect(fetchRelatedMetricsRanking).not.toHaveBeenCalled();
  });

  it('ranks once per metric list and shows the ranking status', async () => {
    localStorage.setItem('gmd.jev.enabled', '1');
    jest.mocked(fetchRelatedMetricsRanking).mockImplementation(async (request) => ({
      ok: true,
      latencyMs: 12,
      response: {
        status: 'ok',
        recommended: [{ id: request.candidates[1].id, p: 0.7 }],
        relationships: { [request.candidates[1].id]: { class: 'investigative_companion', confidence: 0.8 } },
      },
    }));
    const ranking = new RelatedMetricsRanking('demo_requests_total');
    ranking.start(METRICS);
    ranking.start([...METRICS]); // identical list from a second load event
    await flush();

    expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(1);
    const [request] = jest.mocked(fetchRelatedMetricsRanking).mock.calls[0];
    expect(request.candidates.map(({ name }) => name)).not.toContain('demo_requests_total');
    expect(request.selected).toMatchObject({ name: 'demo_requests_total', labelNames: ['job'] });
    expect(ranking.state.status).toBe('ready');

    render(<ranking.Component model={ranking} />);
    expect(screen.getByTestId('related-metrics-ranking')).toHaveTextContent('Sorted by Jev relevance');
  });

  it('retains completed rankings when deactivated and reactivated', async () => {
    localStorage.setItem('gmd.jev.enabled', '1');
    jest.mocked(fetchRelatedMetricsRanking).mockResolvedValue({
      ok: true,
      latencyMs: 12,
      response: { status: 'ok', recommended: [], relationships: {} },
    });
    const ranking = new RelatedMetricsRanking('demo_requests_total');
    let deactivate = ranking.activate();
    ranking.start(METRICS);
    await flush();
    deactivate();

    deactivate = ranking.activate();
    ranking.start([...METRICS]);
    await flush();
    expect(ranking.state.status).toBe('ready');
    expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(1);
    deactivate();
  });

  it('aborts an in-flight request on tab exit and retries on return', async () => {
    localStorage.setItem('gmd.jev.enabled', '1');
    jest.mocked(fetchRelatedMetricsRanking).mockImplementationOnce(() => new Promise(() => {}));
    const ranking = new RelatedMetricsRanking('demo_requests_total');
    let deactivate = ranking.activate();
    ranking.start(METRICS);
    await flush();
    const signal = jest.mocked(fetchRelatedMetricsRanking).mock.calls[0][2];
    deactivate();
    expect(signal?.aborted).toBe(true);

    jest.mocked(fetchRelatedMetricsRanking).mockResolvedValue({ ok: false, reason: 'network' });
    deactivate = ranking.activate();
    ranking.start(METRICS);
    await flush();
    expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(2);
    expect(ranking.state.status).toBe('failed');
    deactivate();
  });

  it('reranks when a metric changes inside an otherwise identical list', async () => {
    localStorage.setItem('gmd.jev.enabled', '1');
    jest.mocked(fetchRelatedMetricsRanking).mockResolvedValue({ ok: false, reason: 'network' });
    const ranking = new RelatedMetricsRanking('demo_requests_total');
    ranking.start(METRICS);
    await flush();
    ranking.start([METRICS[0], 'demo_retries_total', ...METRICS.slice(2)]);
    await flush();
    expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(2);
  });

  it('continues without labels after a one-second enrichment deadline', async () => {
    jest.useFakeTimers();
    try {
      localStorage.setItem('gmd.jev.enabled', '1');
      helper.getLabelNamesForMetric.mockReturnValue(new Promise(() => {}));
      jest.mocked(fetchRelatedMetricsRanking).mockResolvedValue({ ok: false, reason: 'network' });
      const ranking = new RelatedMetricsRanking('demo_requests_total');
      ranking.start(METRICS);
      await jest.advanceTimersByTimeAsync(1000);
      expect(ranking.state.status).toBe('failed');
      expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(1);
      expect(jest.mocked(fetchRelatedMetricsRanking).mock.calls[0][0].selected.labelNames).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('discards enrichment on tab exit without starting Jev or queued lookups', async () => {
    jest.useFakeTimers();
    try {
      localStorage.setItem('gmd.jev.enabled', '1');
      let release!: (labels: string[]) => void;
      const pending = new Promise<string[]>((resolve) => {
        release = resolve;
      });
      helper.getLabelNamesForMetric.mockReturnValue(pending);
      const ranking = new RelatedMetricsRanking('demo_requests_total');
      const deactivate = ranking.activate();
      ranking.start(Array.from({ length: 40 }, (_, i) => `demo_${i}`));
      expect(helper.getLabelNamesForMetric).toHaveBeenCalledTimes(6);
      deactivate();
      await jest.advanceTimersByTimeAsync(0);
      release(['job']);
      await jest.advanceTimersByTimeAsync(1000);
      expect(helper.getLabelNamesForMetric).toHaveBeenCalledTimes(6);
      expect(fetchRelatedMetricsRanking).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('refreshes label evidence and ranking when the time range changes with the same metric names', async () => {
    localStorage.setItem('gmd.jev.enabled', '1');
    jest.mocked(fetchRelatedMetricsRanking).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      response: { status: 'ok', recommended: [], relationships: {} },
    });
    const ranking = new RelatedMetricsRanking('demo_requests_total');
    ranking.start(METRICS);
    await flush();
    helper.getLabelNamesForMetric.mockResolvedValue(['new_range_label']);
    jest.mocked(sceneGraph.getTimeRange).mockReturnValue({
      state: { value: { from: new Date(3), to: new Date(4) } },
    } as never);
    ranking.start(METRICS);
    await flush();
    expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(2);
    expect(jest.mocked(fetchRelatedMetricsRanking).mock.calls[1][0].selected.labelNames).toEqual(['new_range_label']);
  });

  it('explains baseline fallback on failure and exposes details when debugging', async () => {
    localStorage.setItem('gmd.jev.enabled', '1');
    jest.mocked(fetchRelatedMetricsRanking).mockResolvedValue({
      ok: false,
      reason: 'not-ok',
      response: { status: 'disabled', recommended: [], relationships: {} },
    });
    const ranking = new RelatedMetricsRanking('demo_requests_total');
    ranking.start(METRICS);
    await flush();

    expect(ranking.state.status).toBe('failed');
    const first = render(<ranking.Component model={ranking} />);
    expect(screen.getByTestId('related-metrics-ranking')).toHaveTextContent('Showing name-similarity order');
    first.unmount();

    // The scene component wrapper is memoised, so render a fresh tree after enabling debug.
    localStorage.setItem('gmd.jev.debug', '1');
    render(<ranking.Component model={ranking} />);
    expect(screen.getByTestId('related-metrics-ranking-debug')).toHaveTextContent('not-ok/disabled');
  });
});
