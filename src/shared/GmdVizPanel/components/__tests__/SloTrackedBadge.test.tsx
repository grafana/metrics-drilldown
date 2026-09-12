import { sceneGraph } from '@grafana/scenes';
import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { type SloMetricSignals } from 'MetricsReducer/list-controls/MetricsSorter/fetchers/fetchSloMetricSignals';

import { SloTrackedBadge } from '../SloTrackedBadge';

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: {
      ...actual.sceneGraph,
      findByKeyAndType: jest.fn(),
      lookupVariable: jest.fn(),
    },
  };
});

const mockFindByKeyAndType = sceneGraph.findByKeyAndType as jest.Mock;
const mockLookupVariable = sceneGraph.lookupVariable as jest.Mock;

function signals(status: SloMetricSignals['status'], owners: string[] = []): SloMetricSignals {
  return {
    datasourceUid: 'prom-a',
    status,
    trackedMetrics: new Map(owners.length ? [['http_requests_total', new Set(owners)]] : []),
    activeBurnMetrics: new Set(owners.length ? ['http_requests_total'] : []),
  };
}

async function activate(badge: SloTrackedBadge) {
  await act(async () => {
    await (badge as unknown as { loadOwnerCount: () => Promise<void> }).loadOwnerCount();
  });
}

describe('SloTrackedBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLookupVariable.mockReturnValue({ getValue: () => 'prom-a' });
  });

  it('renders one accessible icon with the owning definition count for a tracked metric', async () => {
    const getSloMetricSignals = jest.fn().mockResolvedValue(signals('ready', ['slo-1', 'slo-2']));
    mockFindByKeyAndType.mockReturnValue({ getSloMetricSignals });
    const badge = new SloTrackedBadge({ metric: 'http_requests_total' });

    await activate(badge);
    render(<SloTrackedBadge.Component model={badge} />);

    expect(screen.getByTestId('slo-tracked-badge')).toHaveAccessibleName('2 SLO definitions reference this metric');
    expect(screen.getByTestId('slo-tracked-badge').querySelector('svg')?.closest('span')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(getSloMetricSignals).toHaveBeenCalledWith('prom-a');
  });

  it('uses the same visual for tracked healthy and actively burning metrics', async () => {
    mockFindByKeyAndType.mockReturnValue({
      getSloMetricSignals: jest.fn().mockResolvedValue(signals('ready', ['slo-1'])),
    });
    const burning = new SloTrackedBadge({ metric: 'http_requests_total' });
    await activate(burning);
    const { unmount } = render(<SloTrackedBadge.Component model={burning} />);
    expect(screen.getByTestId('slo-tracked-badge')).toBeInTheDocument();
    unmount();

    const healthySignals = signals('ready', ['slo-1']);
    healthySignals.activeBurnMetrics.clear();
    mockFindByKeyAndType.mockReturnValue({ getSloMetricSignals: jest.fn().mockResolvedValue(healthySignals) });
    const healthy = new SloTrackedBadge({ metric: 'http_requests_total' });
    await activate(healthy);
    render(<SloTrackedBadge.Component model={healthy} />);
    expect(screen.getByTestId('slo-tracked-badge')).toBeInTheDocument();
  });

  it.each(['disabled', 'plugin-absent', 'error'] as const)('stays hidden for %s integration state', async (status) => {
    mockFindByKeyAndType.mockReturnValue({ getSloMetricSignals: jest.fn().mockResolvedValue(signals(status)) });
    const badge = new SloTrackedBadge({ metric: 'http_requests_total' });

    await activate(badge);
    const { container } = render(<SloTrackedBadge.Component model={badge} />);

    expect(container.firstChild).toBeNull();
  });

  it('ignores a stale response after the selected datasource changes', async () => {
    let datasourceUid = 'prom-a';
    let resolveFirst!: (value: SloMetricSignals) => void;
    const firstResult = new Promise<SloMetricSignals>((resolve) => {
      resolveFirst = resolve;
    });
    const getSloMetricSignals = jest
      .fn()
      .mockImplementationOnce(() => firstResult)
      .mockResolvedValueOnce(signals('ready'));
    mockFindByKeyAndType.mockReturnValue({ getSloMetricSignals });
    mockLookupVariable.mockImplementation(() => ({ getValue: () => datasourceUid }));
    const badge = new SloTrackedBadge({ metric: 'http_requests_total' });

    const staleLoad = (badge as unknown as { loadOwnerCount: () => Promise<void> }).loadOwnerCount();
    datasourceUid = 'prom-b';
    await activate(badge);
    resolveFirst(signals('ready', ['slo-1']));
    await staleLoad;
    const { container } = render(<SloTrackedBadge.Component model={badge} />);

    expect(container.firstChild).toBeNull();
  });

  it('clears tracked state when the selected datasource changes', async () => {
    let datasourceUid = 'prom-a';
    const getSloMetricSignals = jest
      .fn()
      .mockImplementation(async (uid: string) => (uid === 'prom-a' ? signals('ready', ['slo-1']) : signals('ready')));
    mockFindByKeyAndType.mockReturnValue({ getSloMetricSignals });
    mockLookupVariable.mockImplementation(() => ({ getValue: () => datasourceUid }));
    const badge = new SloTrackedBadge({ metric: 'http_requests_total' });

    await activate(badge);
    const { container } = render(<SloTrackedBadge.Component model={badge} />);
    expect(screen.getByTestId('slo-tracked-badge')).toBeVisible();

    datasourceUid = 'prom-b';
    await activate(badge);

    expect(container.firstChild).toBeNull();
    expect(getSloMetricSignals).toHaveBeenNthCalledWith(1, 'prom-a');
    expect(getSloMetricSignals).toHaveBeenNthCalledWith(2, 'prom-b');
  });
});
