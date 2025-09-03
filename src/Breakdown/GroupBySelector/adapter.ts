import { type SceneObject } from '@grafana/scenes';

import { createDefaultGroupBySelectorConfig, type GroupBySelectorProps } from './';

/**
 * Legacy model type for backward compatibility
 * Note: This is a placeholder - specific implementations should define their own legacy model types
 */
export type LegacyModel = SceneObject;

/**
 * Creates adapter configuration for GroupBySelector from legacy scene models
 * This allows gradual migration from the old component to the new one
 * Note: This is a generic adapter - specific implementations should create their own adapters
 */
export const createGroupBySelectorAdapter = (
  model: LegacyModel
): Partial<GroupBySelectorProps> => {
  console.warn('Using generic adapter - consider creating a domain-specific adapter');

  // Return safe defaults
  const defaultConfig = createDefaultGroupBySelectorConfig('custom');
  return {
    filters: [],
    ...defaultConfig,
  };
};

/**
 * Enhanced adapter that also handles the model's onChange method
 */
export interface GroupBySelectorAdapterProps {
  model: LegacyModel;
  options: GroupBySelectorProps['options'];
  radioAttributes: GroupBySelectorProps['radioAttributes'];
  value?: GroupBySelectorProps['value'];
  showAll?: GroupBySelectorProps['showAll'];

  // Allow overriding any adapter configuration
  overrides?: Partial<GroupBySelectorProps>;
}

/**
 * Creates complete props for GroupBySelector using the adapter
 */
export const createGroupBySelectorPropsWithAdapter = ({
  model,
  options,
  radioAttributes,
  value,
  showAll = false,
  overrides = {},
}: GroupBySelectorAdapterProps): GroupBySelectorProps => {
  const adapterConfig = createGroupBySelectorAdapter(model);

  return {
    // Core props passed through
    options,
    radioAttributes,
    value,
    onChange: model.onChange.bind(model),
    showAll,

    // Adapter configuration
    ...adapterConfig,

    // User overrides
    ...overrides,
  };
};

/**
 * Utility to check if a scene object is a supported legacy model
 */
export const isLegacyModel = (model: SceneObject): model is LegacyModel => {
  // Generic check - specific implementations should override this
  return model != null;
};

/**
 * Placeholder type guards - specific implementations should define their own
 */
export const isAttributesBreakdownScene = (model: SceneObject): boolean => {
  return false; // Not available in this context
};

export const isAttributesComparisonScene = (model: SceneObject): boolean => {
  return false; // Not available in this context
};
