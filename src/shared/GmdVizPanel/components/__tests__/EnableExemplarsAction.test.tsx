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

function createMockQueryRunner() {
  let subscriber: ((newState: { data?: { state: LoadingState; annotations?: Array<{ length: number }> } }) => void) | undefined;

  return {
    subscribeToState: jest.fn(
      (cb: (newState: { data?: { state: LoadingState; annotations?: Array<{ length: number }> } }) => void) => {
        subscriber = cb;
        return { unsubscribe: jest.fn() };
      }
    ),
    emitData(data: { state: LoadingState; annotations?: Array<{ length: number }> }) {
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
      ['a gauge metric', { metricType: 'gauge', metricTypeResolved: true, panelConfig: { type: 'timeseries' } }],
      [
        'a histogram metric rendered as a heatmap panel',
        { metricType: 'native-histogram', metricTypeResolved: true, panelConfig: { type: 'heatmap' } },
      ],
      [
        'a metric whose type has not resolved yet',
        { metricType: 'counter', metricTypeResolved: false, panelConfig: { type: 'timeseries' } },
      ],
    ])('disables the switch for %s', async (_description, panelState) => {
      const vizPanel = createMockVizPanel({ ...panelState, queryConfig: {} });
      mockGetAncestor.mockReturnValue(vizPanel);

      const action = new EnableExemplarsAction();
      await activateAction(action);

      render(<EnableExemplarsAction.Component model={action} />);
      expect(getSwitchInput().disabled).toBe(true);
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
  });

  describe('getTooltip', () => {
    it('explains unavailability when disabled, regardless of checked state', () => {
      expect(getTooltip(false, true, 'unknown')).toBe("Exemplars aren't available for this metric");
      expect(getTooltip(true, true, 'has-data')).toBe("Exemplars aren't available for this metric");
    });

    it('invites the user to turn it on when unchecked and enabled', () => {
      expect(getTooltip(false, false, 'unknown')).toBe('Show exemplars (counters and histograms only)');
    });

    it('flags empty results once checked and the query came back with no exemplars', () => {
      expect(getTooltip(true, false, 'empty')).toBe('No exemplars found for this metric in the current time range');
    });

    it('confirms exemplars are showing once checked and data is present', () => {
      expect(getTooltip(true, false, 'has-data')).toBe('Showing exemplars');
    });

    it('defaults to the showing-exemplars message while checked and still unknown', () => {
      expect(getTooltip(true, false, 'unknown')).toBe('Showing exemplars');
    });
  });
});
