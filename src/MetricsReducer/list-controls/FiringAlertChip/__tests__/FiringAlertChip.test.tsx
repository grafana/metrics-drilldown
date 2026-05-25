import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { evaluateFeatureFlag } from 'shared/featureFlags/openFeature';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { FiringAlertChip } from '../FiringAlertChip';
import { fetchFiringAlertMetrics } from '../../MetricsSorter/fetchers/fetchFiringAlertMetrics';

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('shared/featureFlags/openFeature', () => ({
  evaluateFeatureFlag: jest.fn(),
}));

jest.mock('shared/tracking/interactions', () => ({
  reportExploreMetrics: jest.fn(),
}));

jest.mock('../../MetricsSorter/fetchers/fetchFiringAlertMetrics', () => ({
  fetchFiringAlertMetrics: jest.fn(),
}));

// Mock scene graph ancestry — FiringAlertChip calls sceneGraph.getAncestor for
// count computation; when there is no real scene, suppress the error gracefully.
jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: {
      ...actual.sceneGraph,
      getAncestor: jest.fn().mockReturnValue({
        state: { enginesMap: new Map() },
      }),
      lookupVariable: jest.fn().mockReturnValue({
        state: { options: [] },
      }),
    },
  };
});

const mockEvaluateFeatureFlag = evaluateFeatureFlag as jest.Mock;
const mockReportExploreMetrics = reportExploreMetrics as jest.Mock;
const mockFetchFiringAlertMetrics = fetchFiringAlertMetrics as jest.Mock;

// =============================================================================
// HELPERS
// =============================================================================

function buildFiringMap(entries: [string, number][]): Map<string, number> {
  return new Map(entries);
}

async function activateChip(chip: FiringAlertChip) {
  // Activation handler is async; wait for it to settle
  const handler = (chip as unknown as { onActivate: () => Promise<void> })['onActivate'];
  await act(async () => {
    await handler.call(chip);
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('FiringAlertChip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('feature flag disabled', () => {
    it('renders nothing when feature flag is off', async () => {
      mockEvaluateFeatureFlag.mockResolvedValue(false);
      mockFetchFiringAlertMetrics.mockResolvedValue(buildFiringMap([]));

      const chip = new FiringAlertChip();
      await activateChip(chip);

      const { container } = render(<FiringAlertChip.Component model={chip} />);
      expect(container.firstChild).toBeNull();
    });

    it('does not fetch firing alert metrics when flag is off', async () => {
      mockEvaluateFeatureFlag.mockResolvedValue(false);

      const chip = new FiringAlertChip();
      await activateChip(chip);

      expect(mockFetchFiringAlertMetrics).not.toHaveBeenCalled();
    });
  });

  describe('feature flag enabled', () => {
    beforeEach(() => {
      mockEvaluateFeatureFlag.mockResolvedValue(true);
    });

    it('shows spinner while loading', async () => {
      // Never resolve to keep loading state
      mockFetchFiringAlertMetrics.mockReturnValue(new Promise(() => {}));

      const chip = new FiringAlertChip();
      // Manually set visible before render to simulate flag resolved
      chip.setState({ visible: true, loading: true });

      render(<FiringAlertChip.Component model={chip} />);
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    });

    it('renders chip with count label after load', async () => {
      mockFetchFiringAlertMetrics.mockResolvedValue(
        buildFiringMap([['http_requests_total', 2], ['cpu_usage', 1]])
      );

      const chip = new FiringAlertChip();
      await activateChip(chip);
      // matchingCount computed from empty options (mocked) → 0 overlap, so count=0 here
      // Force a known count for rendering test
      chip.setState({ matchingCount: 2, loading: false, visible: true });

      render(<FiringAlertChip.Component model={chip} />);
      expect(screen.getByRole('button', { name: /filter by firing alerts/i })).toBeInTheDocument();
      expect(screen.getByText(/has firing alerts \(2\)/i)).toBeInTheDocument();
    });

    it('chip is inactive (not pressed) by default', async () => {
      mockFetchFiringAlertMetrics.mockResolvedValue(
        buildFiringMap([['http_requests_total', 1]])
      );

      const chip = new FiringAlertChip();
      await activateChip(chip);
      chip.setState({ matchingCount: 1, loading: false, visible: true });

      render(<FiringAlertChip.Component model={chip} />);
      const button = screen.getByRole('button', { name: /filter by firing alerts/i });
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    describe('toggle behaviour', () => {
      it('toggles to active on click and publishes EventFiltersChanged with metric names', async () => {
        const firingMap = buildFiringMap([['http_requests_total', 1], ['cpu_usage', 2]]);
        mockFetchFiringAlertMetrics.mockResolvedValue(firingMap);

        const chip = new FiringAlertChip();
        await activateChip(chip);
        chip.setState({ matchingCount: 2, loading: false, visible: true });

        const publishSpy = jest.spyOn(chip, 'publishEvent');

        render(<FiringAlertChip.Component model={chip} />);
        fireEvent.click(screen.getByRole('button', { name: /filter by firing alerts/i }));

        expect(chip.state.active).toBe(true);
        expect(publishSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              type: 'firingAlertMetrics',
              filters: expect.arrayContaining(['http_requests_total', 'cpu_usage']),
            }),
          }),
          true
        );
      });

      it('toggles to inactive on second click and publishes empty filters', async () => {
        const firingMap = buildFiringMap([['http_requests_total', 1]]);
        mockFetchFiringAlertMetrics.mockResolvedValue(firingMap);

        const chip = new FiringAlertChip();
        await activateChip(chip);
        chip.setState({ matchingCount: 1, loading: false, visible: true, active: true });

        const publishSpy = jest.spyOn(chip, 'publishEvent');

        render(<FiringAlertChip.Component model={chip} />);
        // Active chip has different aria-label
        fireEvent.click(screen.getByRole('button', { name: /remove firing alerts filter/i }));

        expect(chip.state.active).toBe(false);
        expect(publishSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ type: 'firingAlertMetrics', filters: [] }),
          }),
          true
        );
      });

      it('fires tracking event with activated + matching_count on toggle on', async () => {
        const firingMap = buildFiringMap([['http_requests_total', 1]]);
        mockFetchFiringAlertMetrics.mockResolvedValue(firingMap);

        const chip = new FiringAlertChip();
        await activateChip(chip);
        chip.setState({ matchingCount: 3, loading: false, visible: true });

        render(<FiringAlertChip.Component model={chip} />);
        fireEvent.click(screen.getByRole('button', { name: /filter by firing alerts/i }));

        expect(mockReportExploreMetrics).toHaveBeenCalledWith('firing_alert_filter_toggled', {
          action: 'activated',
          matching_count: 3,
        });
      });

      it('fires tracking event with deactivated on toggle off', async () => {
        const firingMap = buildFiringMap([['http_requests_total', 1]]);
        mockFetchFiringAlertMetrics.mockResolvedValue(firingMap);

        const chip = new FiringAlertChip();
        await activateChip(chip);
        chip.setState({ matchingCount: 1, loading: false, visible: true, active: true });

        render(<FiringAlertChip.Component model={chip} />);
        fireEvent.click(screen.getByRole('button', { name: /remove firing alerts filter/i }));

        expect(mockReportExploreMetrics).toHaveBeenCalledWith('firing_alert_filter_toggled', {
          action: 'deactivated',
          matching_count: 1,
        });
      });
    });

    describe('edge cases', () => {
      it('shows count 0 and is disabled when fetch returns empty map', async () => {
        mockFetchFiringAlertMetrics.mockResolvedValue(new Map());

        const chip = new FiringAlertChip();
        await activateChip(chip);
        chip.setState({ loading: false, visible: true, matchingCount: 0 });

        render(<FiringAlertChip.Component model={chip} />);
        expect(screen.getByText(/has firing alerts \(0\)/i)).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeDisabled();
      });

      it('shows count 0 when fetch fails', async () => {
        mockFetchFiringAlertMetrics.mockRejectedValue(new Error('network error'));

        const chip = new FiringAlertChip();
        await activateChip(chip);

        expect(chip.state.matchingCount).toBe(0);
        expect(chip.state.loading).toBe(false);
      });
    });

    describe('URL sync', () => {
      it('getUrlState returns filter-firing-alerts=true when active', () => {
        const chip = new FiringAlertChip();
        chip.setState({ active: true });
        expect(chip.getUrlState()).toEqual({ 'filter-firing-alerts': 'true' });
      });

      it('getUrlState returns empty string when inactive', () => {
        const chip = new FiringAlertChip();
        expect(chip.getUrlState()).toEqual({ 'filter-firing-alerts': '' });
      });

      it('updateFromUrl activates chip when value is "true"', () => {
        const chip = new FiringAlertChip();
        chip.updateFromUrl({ 'filter-firing-alerts': 'true' });
        expect(chip.state.active).toBe(true);
      });

      it('updateFromUrl deactivates chip when value is absent', () => {
        const chip = new FiringAlertChip();
        chip.setState({ active: true });
        chip.updateFromUrl({ 'filter-firing-alerts': '' });
        expect(chip.state.active).toBe(false);
      });
    });
  });
});
