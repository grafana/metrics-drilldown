import { type SelectableValue } from '@grafana/data';
import { sceneGraph, type QueryVariable } from '@grafana/scenes';

import { reportExploreMetrics } from '../../interactions';
import { VAR_FILTERS } from '../../shared';
import { isAdHocFiltersVariable } from '../../utils/utils.variables';

import { createDefaultGroupBySelectorConfig, type FilterConfig, type GroupBySelectorProps } from './';

/**
 * Configuration interface for metrics-specific GroupBySelector adapter
 */
export interface MetricsGroupBySelectorConfig {
  /** The GroupByVariable instance from the scene graph */
  groupByVariable: QueryVariable;
  /** Optional filters variable for integration */
  filtersVariable?: any;
  /** Whether to show "All" option */
  showAll?: boolean;
  /** Custom field label */
  fieldLabel?: string;
  /** Custom select placeholder */
  selectPlaceholder?: string;
}

/**
 * Creates GroupBySelector props specifically configured for metrics domain
 * This adapter maintains compatibility with existing GroupByVariable behavior
 */
export const createGroupBySelectorPropsForMetrics = ({
  groupByVariable,
  filtersVariable,
  showAll = true,
  fieldLabel = "By label",
  selectPlaceholder = "Select label..."
}: MetricsGroupBySelectorConfig): GroupBySelectorProps => {
  const { options, value, loading } = groupByVariable.useState();

  // Convert filters to the new format if available
  const filters: FilterConfig[] = filtersVariable && isAdHocFiltersVariable(filtersVariable)
    ? filtersVariable.state.filters.map((f: any) => ({
        key: f.key,
        operator: f.operator,
        value: f.value
      }))
    : [];

  // Get metrics-specific domain configuration
  const metricsConfig = createDefaultGroupBySelectorConfig('metrics');

  // Create onChange handler that maintains GroupByVariable behavior
  const handleChange = (selectedValue: string, ignore?: boolean) => {
    groupByVariable.changeValueTo(selectedValue);

    // Maintain analytics reporting like the original GroupByVariable
    if (selectedValue && !ignore) {
      reportExploreMetrics('groupby_label_changed', { label: selectedValue });
    }
  };

  return {
    // Core selection interface
    options: options as Array<SelectableValue<string>>,
    radioAttributes: [], // Metrics domain typically uses dropdown only
    value: value as string,
    onChange: handleChange,
    showAll,

    // State data extracted from scene graph
    filters,
    currentMetric: undefined, // Could be enhanced to extract current metric
    initialGroupBy: undefined, // Could be enhanced if needed

    // Display configuration
    fieldLabel,
    selectPlaceholder,

    // Apply metrics domain defaults
    ...metricsConfig,

    // Metrics-specific overrides
    filteringRules: {
      ...metricsConfig.filteringRules,
      // Filter out histogram bucket labels like the original GroupByVariable
      customAttributeFilter: (attribute: string) => {
        return attribute !== 'le';
      }
    },

    // Optimize layout for metrics context
    layoutConfig: {
      ...metricsConfig.layoutConfig,
      maxSelectWidth: 200,
      enableResponsiveRadioButtons: false, // Metrics use dropdown only
    },

    // Ensure proper search behavior
    searchConfig: {
      ...metricsConfig.searchConfig,
      enabled: true,
      maxOptions: 100,
    }
  };
};

/**
 * Enhanced adapter that extracts filters variable automatically from scene graph
 */
export const createGroupBySelectorPropsForMetricsWithSceneGraph = (
  groupByVariable: QueryVariable,
  sceneObject: any,
  config: Partial<MetricsGroupBySelectorConfig> = {}
): GroupBySelectorProps => {
  // Automatically extract filters variable from scene graph
  const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, sceneObject);

  return createGroupBySelectorPropsForMetrics({
    groupByVariable,
    filtersVariable: isAdHocFiltersVariable(filtersVariable) ? filtersVariable : undefined,
    showAll: true,
    fieldLabel: "By label",
    selectPlaceholder: "Select label...",
    ...config
  });
};

/**
 * Type guard to check if a variable is a QueryVariable
 */
export const isQueryVariable = (variable: any): variable is QueryVariable => {
  return variable && typeof variable.changeValueTo === 'function';
};

/**
 * Utility to validate metrics adapter configuration
 */
export const validateMetricsAdapterConfig = (config: MetricsGroupBySelectorConfig): boolean => {
  if (!config.groupByVariable) {
    console.warn('MetricsAdapter: groupByVariable is required');
    return false;
  }

  if (!isQueryVariable(config.groupByVariable)) {
    console.warn('MetricsAdapter: groupByVariable must be a QueryVariable instance');
    return false;
  }

  return true;
};
