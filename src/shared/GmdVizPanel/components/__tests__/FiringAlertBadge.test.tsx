import { sceneGraph } from '@grafana/scenes';
import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { isFiringAlertsSortingEnabled } from 'shared/featureFlags/openFeature';

import { FiringAlertBadge } from '../FiringAlertBadge';

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('shared/featureFlags/openFeature', () => ({
  isFiringAlertsSortingEnabled: jest.fn(),
}));

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: {
      ...actual.sceneGraph,
      findByKeyAndType: jest.fn(),
    },
  };
});

const mockIsFiringAlertsSortingEnabled = isFiringAlertsSortingEnabled as jest.Mock;
const mockFindByKeyAndType = sceneGraph.findByKeyAndType as jest.Mock;
const mockGetFiringAlertCountForMetric = jest.fn();

// =============================================================================
// HELPERS
// =============================================================================

async function activateBadge(badge: FiringAlertBadge) {
  const handler = (badge as unknown as { onActivate: () => Promise<void> })['onActivate'];
  await act(async () => {
    await handler.call(badge);
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('FiringAlertBadge', () => {
  describe('feature flag disabled', () => {
    it('renders nothing when the feature flag is off', async () => {
      mockIsFiringAlertsSortingEnabled.mockResolvedValue(false);

      const badge = new FiringAlertBadge({ metric: 'http_requests_total' });
      await activateBadge(badge);

      const { container } = render(<FiringAlertBadge.Component model={badge} />);
      expect(container.firstChild).toBeNull();
    });

    it('does not look up MetricsSorter when flag is off', async () => {
      mockIsFiringAlertsSortingEnabled.mockResolvedValue(false);

      const badge = new FiringAlertBadge({ metric: 'http_requests_total' });
      await activateBadge(badge);

      expect(mockGetFiringAlertCountForMetric).not.toHaveBeenCalled();
    });
  });

  describe('feature flag enabled', () => {
    beforeEach(() => {
      mockIsFiringAlertsSortingEnabled.mockResolvedValue(true);
      mockFindByKeyAndType.mockReturnValue({
        getFiringAlertCountForMetric: mockGetFiringAlertCountForMetric,
      });
    });

    it('renders nothing when the metric has 0 firing alerts', async () => {
      mockGetFiringAlertCountForMetric.mockResolvedValue(0);

      const badge = new FiringAlertBadge({ metric: 'cpu_usage' });
      await activateBadge(badge);

      const { container } = render(<FiringAlertBadge.Component model={badge} />);
      expect(container.firstChild).toBeNull();
      expect(mockGetFiringAlertCountForMetric).toHaveBeenCalledWith('cpu_usage');
    });

    it('renders the bell icon and count when the metric has firing alerts', async () => {
      mockGetFiringAlertCountForMetric.mockResolvedValue(3);

      const badge = new FiringAlertBadge({ metric: 'http_requests_total' });
      await activateBadge(badge);

      const { container } = render(<FiringAlertBadge.Component model={badge} />);
      expect(screen.getByTestId('firing-alert-badge')).toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows the correct count from MetricsSorter cache', async () => {
      mockGetFiringAlertCountForMetric.mockResolvedValue(7);

      const badge = new FiringAlertBadge({ metric: 'node_memory_active_bytes' });
      await activateBadge(badge);

      render(<FiringAlertBadge.Component model={badge} />);
      expect(screen.getByTestId('firing-alert-badge')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(mockGetFiringAlertCountForMetric).toHaveBeenCalledWith('node_memory_active_bytes');
    });
  });
});
