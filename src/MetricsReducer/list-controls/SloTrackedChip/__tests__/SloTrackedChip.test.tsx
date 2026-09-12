import { sceneGraph } from '@grafana/scenes';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { reportExploreMetrics } from 'shared/tracking/interactions';

import { type SloMetricSignals } from '../../MetricsSorter/fetchers/fetchSloMetricSignals';
import { SloTrackedChip } from '../SloTrackedChip';

jest.mock('shared/tracking/interactions', () => ({ reportExploreMetrics: jest.fn() }));

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: {
      ...actual.sceneGraph,
      findByKeyAndType: jest.fn(),
      getAncestor: jest.fn(),
      lookupVariable: jest.fn(),
    },
  };
});

const mockFindByKeyAndType = sceneGraph.findByKeyAndType as jest.Mock;
const mockGetAncestor = sceneGraph.getAncestor as jest.Mock;
const mockLookupVariable = sceneGraph.lookupVariable as jest.Mock;
const mockReportExploreMetrics = reportExploreMetrics as jest.Mock;

function signals(status: SloMetricSignals['status'], metrics: string[] = [], datasourceUid = 'prom-a'): SloMetricSignals {
  return {
    datasourceUid,
    status,
    trackedMetrics: new Map(metrics.map((metric) => [metric, new Set(['slo-1'])])),
    activeBurnMetrics: new Set(),
  };
}

function setup(result: SloMetricSignals, options = ['http_requests_total', 'cpu_usage'], loading = false) {
  const getSloMetricSignals = jest.fn().mockResolvedValue(result);
  mockFindByKeyAndType.mockReturnValue({ getSloMetricSignals });
  mockLookupVariable.mockImplementation((name: string) =>
    name === 'ds'
      ? { getValue: () => result.datasourceUid, state: { name: 'ds' } }
      : { state: { options: options.map((value) => ({ label: value, value })), loading } }
  );
  mockGetAncestor.mockReturnValue({
    state: {
      enginesMap: new Map([
        [
          'filtered-metrics-wingman',
          {
            filterEngine: {
              getFilters: () => ({
                categories: [],
                prefixes: [],
                suffixes: [],
                names: [],
                firingAlertMetrics: [],
                sloTrackedMetrics: [],
              }),
            },
          },
        ],
      ]),
    },
  });
  return { getSloMetricSignals };
}

async function activate(chip: SloTrackedChip) {
  await act(async () => {
    await (chip as unknown as { loadSignals: () => Promise<void> }).loadSignals();
  });
}

describe('SloTrackedChip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the ready matching count and publishes exact tracked names on user toggle', async () => {
    setup(signals('ready', ['http_requests_total', 'not-in-list']));
    const chip = new SloTrackedChip();
    await activate(chip);
    const publish = jest.spyOn(chip, 'publishEvent');

    render(<SloTrackedChip.Component model={chip} />);
    expect(screen.getByText('SLO-tracked (1)')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Filter by SLO-tracked metrics' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);

    expect(chip.state.active).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { type: 'sloTrackedMetrics', filters: ['http_requests_total', 'not-in-list'] },
      }),
      true
    );
    expect(mockReportExploreMetrics).toHaveBeenCalledWith('slo_tracked_filter_toggled', {
      action: 'activated',
      matching_count: 1,
    });
  });

  it.each(['disabled', 'plugin-absent', 'error'] as const)('hides and clears stale state for %s', async (status) => {
    setup(signals(status));
    const chip = new SloTrackedChip();
    chip.setState({ active: true });
    const publish = jest.spyOn(chip, 'publishEvent');

    await activate(chip);
    const { container } = render(<SloTrackedChip.Component model={chip} />);

    expect(container.firstChild).toBeNull();
    expect(chip.state.active).toBe(false);
    expect(chip.getUrlState()).toEqual({ 'filter-slo-tracked': '' });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { type: 'sloTrackedMetrics', filters: [] } }),
      true
    );
  });

  it('shows a disabled zero-count chip for a ready empty definition list', async () => {
    setup(signals('ready'));
    const chip = new SloTrackedChip();
    await activate(chip);

    render(<SloTrackedChip.Component model={chip} />);

    expect(screen.getByText('SLO-tracked (0)')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'No SLO-tracked metrics in the current filtered set'
    );
  });

  it('clears restored state when ready definitions do not match any metric in the selected datasource', async () => {
    setup(signals('ready', ['not-in-list']));
    const chip = new SloTrackedChip();
    chip.updateFromUrl({ 'filter-slo-tracked': 'true' });
    const publish = jest.spyOn(chip, 'publishEvent');

    await activate(chip);

    expect(chip.state.active).toBe(false);
    expect(chip.getUrlState()).toEqual({ 'filter-slo-tracked': '' });
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: { type: 'sloTrackedMetrics', filters: [] } }),
      true
    );
  });

  it('restores URL state only after ready data exists', async () => {
    setup(signals('ready', ['http_requests_total']));
    const chip = new SloTrackedChip();
    chip.updateFromUrl({ 'filter-slo-tracked': 'true' });
    const publish = jest.spyOn(chip, 'publishEvent');

    expect(publish).not.toHaveBeenCalled();
    await activate(chip);

    expect(chip.state.active).toBe(true);
    expect(chip.getUrlState()).toEqual({ 'filter-slo-tracked': 'true' });
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: { type: 'sloTrackedMetrics', filters: ['http_requests_total'] } }),
      true
    );
    expect(mockReportExploreMetrics).not.toHaveBeenCalled();
  });

  it('keeps restored URL state while metric options are still loading', async () => {
    setup(signals('ready', ['http_requests_total']), [], true);
    const chip = new SloTrackedChip();
    chip.updateFromUrl({ 'filter-slo-tracked': 'true' });
    const publish = jest.spyOn(chip, 'publishEvent');

    await activate(chip);

    expect(chip.state.active).toBe(true);
    expect(chip.getUrlState()).toEqual({ 'filter-slo-tracked': 'true' });
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: { type: 'sloTrackedMetrics', filters: ['http_requests_total'] } }),
      true
    );
  });

  it('replaces active membership when the datasource changes without tracking a user toggle', async () => {
    let uid = 'prom-a';
    const getSloMetricSignals = jest.fn().mockImplementation(async (datasourceUid: string) =>
      datasourceUid === 'prom-a'
        ? signals('ready', ['metric_a'], datasourceUid)
        : signals('ready', ['metric_b'], datasourceUid)
    );
    mockFindByKeyAndType.mockReturnValue({ getSloMetricSignals });
    mockLookupVariable.mockImplementation((name: string) =>
      name === 'ds'
        ? { getValue: () => uid, state: { name: 'ds' } }
        : { state: { options: [{ label: 'metric_a', value: 'metric_a' }, { label: 'metric_b', value: 'metric_b' }] } }
    );
    mockGetAncestor.mockReturnValue({
      state: {
        enginesMap: new Map([
          [
            'filtered-metrics-wingman',
            {
              filterEngine: {
                getFilters: () => ({
                  categories: [],
                  prefixes: [],
                  suffixes: [],
                  names: [],
                  firingAlertMetrics: [],
                  sloTrackedMetrics: [],
                }),
              },
            },
          ],
        ]),
      },
    });
    const chip = new SloTrackedChip();
    chip.setState({ active: true });
    const publish = jest.spyOn(chip, 'publishEvent');

    await activate(chip);
    uid = 'prom-b';
    await activate(chip);

    expect(getSloMetricSignals).toHaveBeenNthCalledWith(1, 'prom-a');
    expect(getSloMetricSignals).toHaveBeenNthCalledWith(2, 'prom-b');
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: { type: 'sloTrackedMetrics', filters: ['metric_b'] } }),
      true
    );
    expect(mockReportExploreMetrics).not.toHaveBeenCalled();
  });
});
