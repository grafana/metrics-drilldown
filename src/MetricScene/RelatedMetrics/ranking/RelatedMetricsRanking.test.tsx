import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { MetricSelectedEvent } from 'shared/shared';

import { fetchRelatedMetricsRanking } from './fetchRelatedMetricsRanking';
import { clearMetricLabelNamesCache } from './labelNames';
import { RelatedMetricsRanking } from './RelatedMetricsRanking';

// Implementations are (re)installed in beforeEach because the repo's jest config uses resetMocks.
const helper = {
  peekMetadata: jest.fn(),
  getLabelNamesForMetric: jest.fn(),
};

// Mock only getTrailFor: requiring the real module pulls in DataTrail and a circular import chain.
jest.mock('shared/utils/utils', () => ({
  getTrailFor: () => ({ datasourceHelper: helper }),
}));

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
    clearMetricLabelNamesCache();
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

  it('ranks once per metric list, renders recommendations, and selects on click', async () => {
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
    const publish = jest.spyOn(ranking, 'publishEvent');

    ranking.start(METRICS);
    ranking.start([...METRICS]); // identical list from a second load event
    await flush();

    expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(1);
    const [request] = jest.mocked(fetchRelatedMetricsRanking).mock.calls[0];
    expect(request.candidates.map(({ name }) => name)).not.toContain('demo_requests_total');
    expect(request.selected).toMatchObject({ name: 'demo_requests_total', labelNames: ['job'] });
    expect(ranking.state.status).toBe('ready');

    render(<ranking.Component model={ranking} />);
    const item = screen.getByTestId(`related-metrics-ranking-item-${request.candidates[1].id}`);
    expect(item).toHaveTextContent(request.candidates[1].name);
    expect(item).toHaveTextContent('investigative companion');

    fireEvent.click(item);
    // setState also publishes (state-changed) events, so pick the selection event explicitly.
    const selected = publish.mock.calls.map(([event]) => event).find((event) => event instanceof MetricSelectedEvent);
    expect(publish).toHaveBeenCalledWith(expect.any(MetricSelectedEvent), true);
    expect((selected as MetricSelectedEvent).payload.metric).toBe(request.candidates[1].name);
  });

  it('renders nothing on failure unless debugging', async () => {
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
    expect(first.container).toBeEmptyDOMElement();
    first.unmount();

    // The scene component wrapper is memoised, so render a fresh tree after enabling debug.
    localStorage.setItem('gmd.jev.debug', '1');
    render(<ranking.Component model={ranking} />);
    expect(screen.getByTestId('related-metrics-ranking-debug')).toHaveTextContent('not-ok/disabled');
  });
});
