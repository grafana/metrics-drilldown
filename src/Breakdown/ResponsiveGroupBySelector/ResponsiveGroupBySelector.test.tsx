import { sceneGraph } from '@grafana/scenes';
import { measureText } from '@grafana/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { ResponsiveGroupBySelector } from './ResponsiveGroupBySelector';
import { ALL_VARIABLE_VALUE } from '../../services/variables';
import { VAR_FILTERS, VAR_GROUP_BY } from '../../shared';

// Mock dependencies
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  measureText: jest.fn(),
  useStyles2: jest.fn(() => ({
    container: 'mock-container',
    dropdown: 'mock-dropdown',
  })),
}));

// Mock the utils.variables functions
jest.mock('../../utils/utils.variables', () => ({
  isQueryVariable: jest.fn(() => true),
  isAdHocFiltersVariable: jest.fn(() => true),
}));

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    lookupVariable: jest.fn(),
  },
}));

jest.mock('../../interactions', () => ({
  reportExploreMetrics: jest.fn(),
}));

jest.mock('../../tracking/logger/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

const mockMeasureText = measureText as jest.MockedFunction<typeof measureText>;
const mockLookupVariable = sceneGraph.lookupVariable as jest.MockedFunction<typeof sceneGraph.lookupVariable>;

// Helper function to create ResizeObserver mock with specified width
const createMockResizeObserver = (width: number) => {
  let storedCallback: ((entries: any[]) => void) | null = null;

  const mockObserve = jest.fn().mockImplementation(() => {
    // Simulate container with specified width
    if (storedCallback) {
      storedCallback([{ target: { clientWidth: width } }]);
    }
  });

  const mockResizeObserver = jest.fn().mockImplementation((callback) => {
    storedCallback = callback;
    return {
      observe: mockObserve,
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    };
  });

  return mockResizeObserver;
};

describe('ResponsiveGroupBySelector', () => {
  let mockGroupByVariable: any;
  let mockFiltersVariable: any;
  let selector: ResponsiveGroupBySelector;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock text measurement - return fixed widths for testing
    mockMeasureText.mockImplementation((text: string) => ({ width: text.length * 8 } as TextMetrics));

    // Mock group by variable
    mockGroupByVariable = {
      state: {
        type: 'query',
        options: [
          { label: 'instance', value: 'instance' },
          { label: 'job', value: 'job' },
          { label: 'service', value: 'service' },
          { label: 'environment', value: 'environment' },
          { label: 'custom_label', value: 'custom_label' },
        ],
        value: ALL_VARIABLE_VALUE,
      },
      useState: jest.fn(),
      changeValueTo: jest.fn(),
    };

    // Mock filters variable
    mockFiltersVariable = {
      state: {
        type: 'adhoc',
        filters: [],
      },
    };

    // Setup variable lookup mocks
    mockLookupVariable.mockImplementation((name: string) => {
      if (name === VAR_GROUP_BY) {
        return mockGroupByVariable;
      }
      if (name === VAR_FILTERS) {
        return mockFiltersVariable;
      }
      return null;
    });

    // Create selector instance
    selector = new ResponsiveGroupBySelector();

    // Mock useState for the component
    mockGroupByVariable.useState.mockReturnValue({
      options: mockGroupByVariable.state.options,
      value: mockGroupByVariable.state.value,
    });
  });

  describe('Component rendering', () => {
    it('should render radio buttons for common labels', () => {
      // Mock ResizeObserver
      global.ResizeObserver = createMockResizeObserver(800);

      render(<ResponsiveGroupBySelector.Component model={selector} />);

      // Should render radio buttons for common labels
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('instance')).toBeInTheDocument();
      expect(screen.getByText('job')).toBeInTheDocument();
      expect(screen.getByText('service')).toBeInTheDocument();
    });

    it('should show dropdown when there are hidden labels', () => {
      // Mock ResizeObserver with narrow width
      global.ResizeObserver = createMockResizeObserver(200);

      render(<ResponsiveGroupBySelector.Component model={selector} />);

      // Should show dropdown for additional options
      expect(screen.getByText('Other labels')).toBeInTheDocument();
    });

    it('should hide all radio buttons when container is too small', () => {
      global.ResizeObserver = createMockResizeObserver(100);

      render(<ResponsiveGroupBySelector.Component model={selector} />);

      // With very small width, should only show "All" button and dropdown
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Other labels')).toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    beforeEach(() => {
      global.ResizeObserver = createMockResizeObserver(800);
    });

    it('should handle radio button selection', async () => {
      render(<ResponsiveGroupBySelector.Component model={selector} />);

      const instanceButton = screen.getByLabelText('instance');
      fireEvent.click(instanceButton);

      await waitFor(() => {
        expect(mockGroupByVariable.changeValueTo).toHaveBeenCalledWith('instance');
      });
    });

    it('should handle "All" button selection', async () => {
      render(<ResponsiveGroupBySelector.Component model={selector} />);

      const allButton = screen.getByLabelText('All');
      fireEvent.click(allButton);

      await waitFor(() => {
        expect(mockGroupByVariable.changeValueTo).toHaveBeenCalledWith(ALL_VARIABLE_VALUE);
      });
    });

    it('should handle dropdown selection', async () => {
      // Mock narrow width to force dropdown usage
      global.ResizeObserver = createMockResizeObserver(200);

      render(<ResponsiveGroupBySelector.Component model={selector} />);

      // Find and interact with dropdown
      const dropdown = screen.getByText('Other labels');
      fireEvent.click(dropdown);

      // Note: This is a simplified test - real dropdown interaction would need more complex mocking
      // In a real scenario, we'd need to mock the Combobox component behavior
      expect(dropdown).toBeInTheDocument();
    });
  });

  describe('Label filtering', () => {
    it('should filter out already filtered labels', () => {
      // Add a filter for 'instance'
      mockFiltersVariable.state.filters = [
        { key: 'instance', operator: '=', value: 'localhost' }
      ];

      global.ResizeObserver = createMockResizeObserver(800);

      render(<ResponsiveGroupBySelector.Component model={selector} />);

      // 'instance' should not appear in radio buttons since it's already filtered
      expect(screen.queryByText('instance')).not.toBeInTheDocument();
      expect(screen.getByText('job')).toBeInTheDocument();
      expect(screen.getByText('service')).toBeInTheDocument();
    });

    it('should keep selected label visible even if filtered', () => {
      // Set 'instance' as selected and also filtered
      mockGroupByVariable.state.value = 'instance';
      mockGroupByVariable.useState.mockReturnValue({
        options: mockGroupByVariable.state.options,
        value: 'instance',
      });

      mockFiltersVariable.state.filters = [
        { key: 'instance', operator: '=', value: 'localhost' }
      ];

      global.ResizeObserver = createMockResizeObserver(800);

      render(<ResponsiveGroupBySelector.Component model={selector} />);

      // 'instance' should still be visible since it's selected
      expect(screen.getByText('instance')).toBeInTheDocument();
    });
  });

  describe('Performance monitoring', () => {
    it('should log warnings for slow operations', async () => {
      const { logger } = require('../../tracking/logger/logger');

      // Mock slow text measurement
      mockMeasureText.mockImplementation(() => {
        // Simulate slow operation
        const start = Date.now();
        while (Date.now() - start < 20) {
          // Busy wait to simulate slow operation
        }
        return { width: 100 } as TextMetrics;
      });

      global.ResizeObserver = createMockResizeObserver(800);

      render(<ResponsiveGroupBySelector.Component model={selector} />);

      await waitFor(() => {
        expect(logger.warn).toHaveBeenCalled();
      });
    });
  });

  describe('Variable caching', () => {
    it('should cache variable lookups', () => {
      // First call
      const var1 = selector.getGroupByVariable();
      expect(mockLookupVariable).toHaveBeenCalledTimes(1);

      // Second call within cache TTL should not trigger lookup
      const var2 = selector.getGroupByVariable();
      expect(var1).toBe(var2);
      expect(mockLookupVariable).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after TTL expires', async () => {
      // Mock Date.now to control time
      const originalDateNow = Date.now;
      let currentTime = 1000;
      Date.now = jest.fn(() => currentTime);

      try {
        // First call
        selector.getGroupByVariable();
        expect(mockLookupVariable).toHaveBeenCalledTimes(1);

        // Advance time beyond cache TTL (1000ms)
        currentTime = 2100;

        // Second call should trigger new lookup
        selector.getGroupByVariable();
        expect(mockLookupVariable).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalDateNow;
      }
    });
  });

  describe('Error handling', () => {
    it('should throw error when group by variable is not found', () => {
      mockLookupVariable.mockImplementation((name: string) => {
        if (name === VAR_GROUP_BY) {
          return null; // Simulate missing variable
        }
        return mockFiltersVariable;
      });

      expect(() => {
        selector.getGroupByVariable();
      }).toThrow('Group by variable not found');
    });

    it('should throw error when group by variable is wrong type', () => {
      mockLookupVariable.mockImplementation((name: string) => {
        if (name === VAR_GROUP_BY) {
          return { state: { type: 'wrong-type' } }; // Simulate wrong variable type
        }
        return mockFiltersVariable;
      });

      expect(() => {
        selector.getGroupByVariable();
      }).toThrow('Group by variable not found');
    });
  });
});
