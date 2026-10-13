import { LoadingState } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { reportExploreMetrics } from 'shared/tracking/interactions';

import { EnableExemplarsAction, getTooltip } from '../EnableExemplarsAction';

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('shared/tracking/interactions', () => ({
  reportExploreMetrics: jest.fn(),
}));

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: {
      ...actual.sceneGraph,
      getAncestor: jest.fn(),
      findDescendents: jest.fn(),
    },
  };
});

const mockGetAncestor = sceneGraph.getAncestor as jest.Mock;
const mockFindDescendents = sceneGraph.findDescendents as jest.Mock;
const mockReportExploreMetrics = reportExploreMetrics as jest.Mock;

// =============================================================================
// HELPERS
// =============================================================================

function createMockVizPanel(state: {
  metricType: string;
  metricTypeResolved: boolean;
  panelConfig: { type: string };
  queryConfig: { exemplarsEnabled?: boolean };
  body?: unknown;
}) {
  let subscriber: ((newState: typeof state, prevState: typeof state) => void) | undefined;

  return {
    state,
    update: jest.fn(),
    subscribeToState: jest.fn((cb: (newState: typeof state, prevState: typeof state) => void) => {
      subscriber = cb;
      return { unsubscribe: jest.fn() };
    }),
    emitStateChange(nextState: Partial<typeof state>) {
      const prevState = { ...this.state };
      this.state = { ...this.state, ...nextState };
      subscriber?.(this.state, prevState);
    },
  };
}

type MockQueryRunnerData = { state: LoadingState; annotations?: Array<{ length: number }> };

function createMockQueryRunner(initialData?: MockQueryRunnerData) {
  let subscriber: ((newState: { data?: MockQueryRunnerData }) => void) | undefined;

  return {
    state: { data: initialData },
    subscribeToState: jest.fn((cb: (newState: { data?: MockQueryRunnerData }) => void) => {
      subscriber = cb;
      return { unsubscribe: jest.fn() };
    }),
    emitData(data: MockQueryRunnerData) {
      this.state.data = data;
      subscriber?.({ data });
    },
  };
}

async function activateAction(action: EnableExemplarsAction) {
  const handler = (action as unknown as { onActivate: () => void })['onActivate'];
  await act(() => {
    handler.call(action);
  });
}

function getSwitchInput() {
  return screen.getByTestId('enable-exemplars-action') as HTMLInputElement;
}

// =============================================================================
// TESTS
// =============================================================================

describe('EnableExemplarsAction', () => {
  beforeEach(() => {
    mockFindDescendents.mockReturnValue([]);
  });

  describe('switch state', () => {
    it('renders an unchecked, enabled switch for a resolved counter metric on a timeseries panel', async () => {
      const vizPanel = createMockVizPanel({
        metricType: 'counter',
        metricTypeResolved: true,
        panelConfig: { type: 'timeseries' },
        queryConfig: {},
      });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);
      const input = getSwitchInput();
      expect(input.checked).toBe(false);
      expect(input.disabled).toBe(false);
    });

    it.each([
      [
        'a gauge metric',
        { metricType: 'gauge', metricTypeResolved: true, panelConfig: { type: 'timeseries' } },
        "Exemplars aren't available for this metric",
      ],
      [
        'a metric whose type has not resolved yet',
        { metricType: 'counter', metricTypeResolved: false, panelConfig: { type: 'timeseries' } },
        "Exemplars aren't available for this metric",
      ],
    ])('disables the switch for %s, with a metric-type tooltip', async (_description, panelState, expectedTooltip) => {
      const vizPanel = createMockVizPanel({ ...panelState, queryConfig: {} });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);
      expect(getSwitchInput().disabled).toBe(true);
      expect(getTooltip(false, action.state.disabledReason, 'unknown')).toBe(expectedTooltip);
    });

    it('disables the switch for a histogram rendered as a heatmap, with a panel-type tooltip pointing at Percentiles', async () => {
      // Regression test: histograms default to the heatmap panel type (getPanelTypeForMetricSync),
      // not percentiles, so this is the common case for a histogram metric, not an edge case. The
      // metric type itself supports exemplars; only the panel type doesn't (core's heatmap panel can
      // render exemplars, but this app's heatmap query builder doesn't attach the flag), so the
      // tooltip should say so instead of the generic "not available for this metric" message.
      const vizPanel = createMockVizPanel({
        metricType: 'native-histogram',
        metricTypeResolved: true,
        panelConfig: { type: 'heatmap' },
        queryConfig: {},
      });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);
      expect(getSwitchInput().disabled).toBe(true);
      expect(action.state.disabledReason).toBe('panel-type');
      expect(getTooltip(false, action.state.disabledReason, 'unknown')).toBe(
        'Switch to the Percentiles view to show exemplars'
      );
    });

    it('enables the switch once a histogram switches from heatmap to percentiles', async () => {
      const vizPanel = createMockVizPanel({
        metricType: 'native-histogram',
        metricTypeResolved: true,
        panelConfig: { type: 'heatmap' },
        queryConfig: {},
      });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);
      expect(getSwitchInput().disabled).toBe(true);

      act(() => {
        vizPanel.emitStateChange({ panelConfig: { type: 'percentiles' } });
      });

      expect(getSwitchInput().disabled).toBe(false);
    });

    it('re-enables once the ancestor resolves the metric type', async () => {
      const vizPanel = createMockVizPanel({
        metricType: 'counter',
        metricTypeResolved: false,
        panelConfig: { type: 'timeseries' },
        queryConfig: {},
      });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);
      expect(getSwitchInput().disabled).toBe(true);

      act(() => {
        vizPanel.emitStateChange({ metricTypeResolved: true });
      });

      expect(getSwitchInput().disabled).toBe(false);
    });

    it('calls GmdVizPanel.update with the new value and reports the interaction on change', async () => {
      const vizPanel = createMockVizPanel({
        metricType: 'counter',
        metricTypeResolved: true,
        panelConfig: { type: 'timeseries' },
        queryConfig: {},
      });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);
      fireEvent.click(getSwitchInput());

      expect(vizPanel.update).toHaveBeenCalledWith({}, { exemplarsEnabled: true });
      expect(mockReportExploreMetrics).toHaveBeenCalledWith('exemplars_toggle_changed', { enabled: true });
    });

    it('checks the switch once enabled, and flags empty results once the query completes with no exemplars', async () => {
      const queryRunner = createMockQueryRunner();
      mockFindDescendents.mockReturnValue([queryRunner]);

      const vizPanel = createMockVizPanel({
        metricType: 'counter',
        metricTypeResolved: true,
        panelConfig: { type: 'timeseries' },
        queryConfig: { exemplarsEnabled: true },
        body: {},
      });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);
      expect(getSwitchInput().checked).toBe(true);

      act(() => {
        queryRunner.emitData({ state: LoadingState.Done, annotations: [] });
      });

      expect(getSwitchInput().getAttribute('data-status')).toBe('empty');
    });

    it('does not flag empty results once the query returns a non-empty exemplar frame', async () => {
      const queryRunner = createMockQueryRunner();
      mockFindDescendents.mockReturnValue([queryRunner]);

      const vizPanel = createMockVizPanel({
        metricType: 'counter',
        metricTypeResolved: true,
        panelConfig: { type: 'timeseries' },
        queryConfig: { exemplarsEnabled: true },
        body: {},
      });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);

      act(() => {
        queryRunner.emitData({ state: LoadingState.Done, annotations: [{ length: 3 }] });
      });

      expect(getSwitchInput().getAttribute('data-status')).toBe('has-data');
    });

    it('reflects data that already finished before the subscription was set up', async () => {
      // Regression test: subscribeToState only fires on subsequent changes, not the value already
      // present at subscribe time (confirmed against the real @grafana/scenes source). A panel that
      // rebuilds with exemplarsEnabled already true, or a query that finished before this action
      // activated, would otherwise leave dataStatus stuck at 'unknown' forever.
      const queryRunner = createMockQueryRunner({ state: LoadingState.Done, annotations: [{ length: 2 }] });
      mockFindDescendents.mockReturnValue([queryRunner]);

      const vizPanel = createMockVizPanel({
        metricType: 'counter',
        metricTypeResolved: true,
        panelConfig: { type: 'timeseries' },
        queryConfig: { exemplarsEnabled: true },
        body: {},
      });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);

      expect(getSwitchInput().getAttribute('data-status')).toBe('has-data');
    });
  });

  describe('getTooltip', () => {
    it('explains unavailability when the metric type disables it, regardless of checked state', () => {
      expect(getTooltip(false, 'metric-type', 'unknown')).toBe("Exemplars aren't available for this metric");
      expect(getTooltip(true, 'metric-type', 'has-data')).toBe("Exemplars aren't available for this metric");
    });

    it('points at Percentiles when the panel type disables it', () => {
      expect(getTooltip(false, 'panel-type', 'unknown')).toBe('Switch to the Percentiles view to show exemplars');
    });

    it('invites the user to turn it on when unchecked and enabled', () => {
      expect(getTooltip(false, null, 'unknown')).toBe('Show exemplars (counters and histograms only)');
    });

    it('flags empty results once checked and the query came back with no exemplars', () => {
      expect(getTooltip(true, null, 'empty')).toBe('No exemplars found for this metric in the current time range');
    });

    it('confirms exemplars are showing once checked and data is present', () => {
      expect(getTooltip(true, null, 'has-data')).toBe('Showing exemplars');
    });

    it('defaults to the showing-exemplars message while checked and still unknown', () => {
      expect(getTooltip(true, null, 'unknown')).toBe('Showing exemplars');
    });
  });
});
