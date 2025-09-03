import { type SelectableValue } from '@grafana/data';
import { type QueryVariable } from '@grafana/scenes';

import { createGroupBySelectorPropsForMetrics, validateMetricsAdapterConfig } from './metrics-adapter';
import { reportExploreMetrics } from '../../interactions';

// Mock the interactions module
jest.mock('../../interactions', () => ({
  reportExploreMetrics: jest.fn(),
}));

// Mock the utils.variables module
jest.mock('../../utils/utils.variables', () => ({
  isAdHocFiltersVariable: jest.fn(),
}));

import { isAdHocFiltersVariable } from '../../utils/utils.variables';

describe('Metrics Adapter', () => {
  let mockGroupByVariable: jest.Mocked<QueryVariable>;
  let mockFiltersVariable: any;

  beforeEach(() => {
    // Create mock GroupByVariable
    mockGroupByVariable = {
      useState: jest.fn(),
      changeValueTo: jest.fn(),
    } as any;

    // Create mock filters variable
    mockFiltersVariable = {
      state: {
        filters: [
          { key: 'instance', operator: '=', value: 'localhost:9090' },
          { key: 'job', operator: '!=', value: 'test' },
        ],
      },
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createGroupBySelectorPropsForMetrics', () => {
    it('should create props with metrics-specific configuration', () => {
      const mockOptions: Array<SelectableValue<string>> = [
        { label: 'Instance', value: 'instance' },
        { label: 'Job', value: 'job' },
        { label: 'LE', value: 'le' }, // Should be filtered out
      ];

      mockGroupByVariable.useState.mockReturnValue({
        options: mockOptions,
        value: 'instance',
        loading: false,
      });

      // Mock isAdHocFiltersVariable to return true for our mock
      (isAdHocFiltersVariable as jest.Mock).mockReturnValue(true);

      const props = createGroupBySelectorPropsForMetrics({
        groupByVariable: mockGroupByVariable,
        filtersVariable: mockFiltersVariable,
        showAll: true,
        fieldLabel: "By label",
      });

      // Verify core props
      expect(props.options).toEqual(mockOptions);
      expect(props.radioAttributes).toEqual([]); // Metrics use dropdown only
      expect(props.value).toBe('instance');
      expect(props.showAll).toBe(true);
      expect(props.fieldLabel).toBe("By label");

      // Verify filters conversion
      expect(props.filters).toEqual([
        { key: 'instance', operator: '=', value: 'localhost:9090' },
        { key: 'job', operator: '!=', value: 'test' },
      ]);

      // Verify metrics-specific configuration
      expect(props.filteringRules?.customAttributeFilter).toBeDefined();
      expect(props.layoutConfig?.enableResponsiveRadioButtons).toBe(false);
      expect(props.layoutConfig?.maxSelectWidth).toBe(200);
      expect(props.searchConfig?.maxOptions).toBe(100);
    });

    it('should handle onChange with analytics reporting', () => {
      mockGroupByVariable.useState.mockReturnValue({
        options: [],
        value: '',
        loading: false,
      });

      const props = createGroupBySelectorPropsForMetrics({
        groupByVariable: mockGroupByVariable,
      });

      // Test onChange handler
      props.onChange('instance', false);

      expect(mockGroupByVariable.changeValueTo).toHaveBeenCalledWith('instance');
      expect(reportExploreMetrics).toHaveBeenCalledWith('groupby_label_changed', { label: 'instance' });
    });

    it('should not report analytics when ignore flag is set', () => {
      mockGroupByVariable.useState.mockReturnValue({
        options: [],
        value: '',
        loading: false,
      });

      const props = createGroupBySelectorPropsForMetrics({
        groupByVariable: mockGroupByVariable,
      });

      // Test onChange with ignore flag
      props.onChange('instance', true);

      expect(mockGroupByVariable.changeValueTo).toHaveBeenCalledWith('instance');
      expect(reportExploreMetrics).not.toHaveBeenCalled();
    });

    it('should filter out "le" labels using custom filter', () => {
      mockGroupByVariable.useState.mockReturnValue({
        options: [],
        value: '',
        loading: false,
      });

      const props = createGroupBySelectorPropsForMetrics({
        groupByVariable: mockGroupByVariable,
      });

      const customFilter = props.filteringRules?.customAttributeFilter;
      expect(customFilter).toBeDefined();

      if (customFilter) {
        expect(customFilter('le')).toBe(false);
        expect(customFilter('instance')).toBe(true);
        expect(customFilter('job')).toBe(true);
      }
    });

    it('should handle missing filters variable gracefully', () => {
      mockGroupByVariable.useState.mockReturnValue({
        options: [],
        value: '',
        loading: false,
      });

      const props = createGroupBySelectorPropsForMetrics({
        groupByVariable: mockGroupByVariable,
        filtersVariable: undefined,
      });

      expect(props.filters).toEqual([]);
    });
  });

  describe('validateMetricsAdapterConfig', () => {
    it('should validate correct configuration', () => {
      const config = {
        groupByVariable: mockGroupByVariable,
      };

      const isValid = validateMetricsAdapterConfig(config);
      expect(isValid).toBe(true);
    });

    it('should reject missing groupByVariable', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const config = {
        groupByVariable: undefined as any,
      };

      const isValid = validateMetricsAdapterConfig(config);
      expect(isValid).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('MetricsAdapter: groupByVariable is required');

      consoleSpy.mockRestore();
    });

    it('should reject invalid groupByVariable type', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const config = {
        groupByVariable: { invalid: 'object' } as any,
      };

      const isValid = validateMetricsAdapterConfig(config);
      expect(isValid).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('MetricsAdapter: groupByVariable must be a QueryVariable instance');

      consoleSpy.mockRestore();
    });
  });
});
