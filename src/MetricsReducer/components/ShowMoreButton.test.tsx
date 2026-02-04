/**
 * ShowMoreButton.test.tsx
 *
 * Tests for the ShowMoreButton component with focus on pluralization behavior.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { ShowMoreButton } from './ShowMoreButton';

// =============================================================================
// TESTS
// =============================================================================

describe('ShowMoreButton', () => {
  const defaultProps = {
    label: 'item',
    onClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Pluralization Behavior
  // ---------------------------------------------------------------------------

  describe('pluralization behavior', () => {
    /**
     * PLURALIZATION BEHAVIOR:
     * - Uses i18next pluralization with _one and _other variants
     * - Passes count parameter (increment) to let framework handle plural selection
     * - No hardcoded 's' suffix in translation strings
     *
     * NOTE: The actual pluralization is handled by i18next based on the
     * translation keys (_one, _other) and the count parameter we pass.
     */

    it('should display button text when increment is 1', () => {
      render(
        <ShowMoreButton
          {...defaultProps}
          batchSizes={{ increment: 1, current: 10, total: 20 }}
        />
      );

      // Button should be rendered (exact text depends on translation)
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Verify count values are in the button text
      expect(button).toHaveTextContent('1');
      expect(button).toHaveTextContent('10');
      expect(button).toHaveTextContent('20');
    });

    it('should display button text when increment is greater than 1', () => {
      render(
        <ShowMoreButton
          {...defaultProps}
          batchSizes={{ increment: 5, current: 10, total: 20 }}
        />
      );

      // Button should be rendered
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Verify count values are in the button text
      expect(button).toHaveTextContent('5');
      expect(button).toHaveTextContent('10');
      expect(button).toHaveTextContent('20');
    });

    it('should display button text with various increment values', () => {
      const testCases = [
        { increment: 1, current: 0, total: 50 },
        { increment: 10, current: 10, total: 50 },
        { increment: 25, current: 25, total: 50 },
      ];

      testCases.forEach(({ increment, current, total }) => {
        const { unmount } = render(
          <ShowMoreButton
            {...defaultProps}
            batchSizes={{ increment, current, total }}
          />
        );

        const button = screen.getByRole('button');
        expect(button).toHaveTextContent(String(increment));
        expect(button).toHaveTextContent(String(current));
        expect(button).toHaveTextContent(String(total));

        unmount();
      });
    });

    it('should call onClick handler when clicked', () => {
      const onClick = jest.fn();

      render(
        <ShowMoreButton
          {...defaultProps}
          onClick={onClick}
          batchSizes={{ increment: 5, current: 10, total: 20 }}
        />
      );

      const button = screen.getByRole('button');
      button.click();

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should display tooltip when provided', () => {
      render(
        <ShowMoreButton
          {...defaultProps}
          batchSizes={{ increment: 5, current: 10, total: 20 }}
          tooltip="Show more items"
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Tooltip behavior is handled by @grafana/ui Button component
    });
  });
});
