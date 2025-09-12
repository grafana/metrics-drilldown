import { type SelectableValue } from '@grafana/data';
import { measureText } from '@grafana/ui';

import {
  type AttributePrefixConfig,
  type DomainConfig,
  type FilterContext,
  type FilteringRulesConfig,
  type ProcessedAttribute,
  type RadioProcessingConfig,
  type SearchConfig,
} from './types';

/**
 * Creates an attribute filter function based on the provided rules and context
 */
export const createAttributeFilter = (
  rules: FilteringRulesConfig,
  context: FilterContext
) => (attribute: string): boolean => {
  // Apply custom filter if provided
  if (rules.customAttributeFilter) {
    return rules.customAttributeFilter(attribute, context);
  }

  // Compute exclusion flags and return a single boolean
  const excludedByActiveFilter =
    rules.excludeFilteredFromRadio &&
    context.filters.some(
      (f) => f.key === attribute && (f.operator === '=' || f.operator === '!=')
    );

  const excludedByMetric = Boolean(
    rules.excludeAttributesForMetrics &&
      context.currentMetric &&
      (rules.excludeAttributesForMetrics[context.currentMetric] || []).includes(attribute)
  );

  const excludedByOtherFilters = Boolean(
    rules.excludeAttributesForFilters &&
      context.filters.some(
        (filter) => (rules.excludeAttributesForFilters?.[filter.key] || []).includes(attribute)
      )
  );

  return !(excludedByActiveFilter || excludedByMetric || excludedByOtherFilters);
};

/**
 * Processes radio attributes based on available options, filters, and rules
 * Simplified version using config object approach
 */
export const processRadioAttributes = (
  radioAttributes: string[],
  options: Array<SelectableValue<string>>,
  rules: FilteringRulesConfig,
  context: FilterContext,
  config: RadioProcessingConfig
): ProcessedAttribute[] => {
  const attributeFilter = createAttributeFilter(rules, context);
  const optionValues = new Set(options.map(opt => opt.value));

  let accumulatedWidth = 0;
  const reservedWidth = config.widthOfOtherAttributes;

  // If requested, include the width of the implicit "All" radio in budgeting
  if (config.includeAllOptionInWidth) {
    const allLabel = config.allOptionLabel ?? 'All';
    const allTextWidth = measureText(allLabel, config.fontSize).width;
    const allRequiredWidth = allTextWidth + config.additionalWidthPerItem;
    accumulatedWidth += allRequiredWidth;
  }

  return radioAttributes
    .filter(attribute =>
      optionValues.has(attribute) && attributeFilter(attribute)
    )
    .map(attribute => ({
      label: removeAttributePrefixes(attribute, config.attributePrefixes),
      text: attribute,
      value: attribute,
    }))
    .filter(option => {
      const textWidth = measureText(option.label, config.fontSize).width;
      const requiredWidth = textWidth + config.additionalWidthPerItem;

      if (accumulatedWidth + requiredWidth + reservedWidth <= config.availableWidth) {
        accumulatedWidth += requiredWidth;
        return true;
      }
      return false;
    });
};

/**
 * Removes attribute prefixes from labels for display
 */
export const removeAttributePrefixes = (
  attribute: string,
  prefixes: AttributePrefixConfig
): string => {
  for (const [, prefix] of Object.entries(prefixes)) {
    if (prefix && attribute.startsWith(prefix)) {
      return attribute.replace(prefix, '');
    }
  }
  return attribute;
};

/**
 * Filters options based on search query
 */
export const filteredOptions = (
  options: Array<SelectableValue<string>>,
  query: string,
  searchConfig: SearchConfig
): Array<SelectableValue<string>> => {
  if (options.length === 0) {
    return [];
  }

  if (query.length === 0) {
    return options.slice(0, searchConfig.maxOptions || 1000);
  }

  const searchQuery = searchConfig.caseSensitive ? query : query.toLowerCase();
  const searchFields = searchConfig.searchFields || ['label', 'value'];

  return options
    .filter((option) => {
      return searchFields.some((field) => {
        const fieldValue = option[field];
        if (fieldValue && fieldValue.length > 0) {
          const searchText = searchConfig.caseSensitive
            ? fieldValue.toString()
            : fieldValue.toString().toLowerCase();
          return searchText.includes(searchQuery);
        }
        return false;
      });
    })
    .slice(0, searchConfig.maxOptions || 1000);
};

/**
 * Processes select options by removing ignored attributes and applying prefixes
 */
export const getModifiedSelectOptions = (
  options: Array<SelectableValue<string>>,
  ignoredAttributes: string[],
  attributePrefixes: AttributePrefixConfig
): Array<SelectableValue<string>> => {
  return options
    .filter((option) => !ignoredAttributes.includes(option.value?.toString() || ''))
    .map((option) => ({
      label: option.label
        ? removeAttributePrefixes(option.label, attributePrefixes)
        : undefined,
      value: option.value,
    }));
};

/**
 * Derive radio attributes directly from options with a threshold heuristic.
 * Includes an implicit "All" option in the threshold calculation and excludes $__all.
 */
export const deriveRadioAttributesFromOptions = (
  options: Array<{ value?: string }>,
  threshold = 4
): string[] => {
  const totalOptions = options.length + 1; // include implicit "All"
  if (totalOptions > threshold) {
    return [];
  }
  return options
    .map((o) => o.value as string)
    .filter((v): v is string => Boolean(v) && v !== '$__all');
};

/**
 * Creates default configuration for GroupBySelector optimized for metrics
 */
export const createDefaultGroupBySelectorConfig = (): Partial<DomainConfig> => {
  return {
    attributePrefixes: {},
    filteringRules: {
      excludeFilteredFromRadio: true,
      // Custom filter to exclude histogram bucket labels like GroupByVariable does
      customAttributeFilter: (attribute: string) => {
        return attribute !== 'le';
      }
    },
    ignoredAttributes: ['__name__', 'timestamp', 'le'],
    layoutConfig: {
      additionalWidthPerItem: 40,
      widthOfOtherAttributes: 200,
    },
    searchConfig: {
      enabled: true,
      maxOptions: 100, // Reasonable limit for metrics labels
      caseSensitive: false,
      searchFields: ['label', 'value'],
    },
    virtualizationConfig: {
      enabled: true,
      itemHeight: 32,
      maxHeight: 300,
    },
  };
};

/**
 * Merges user configuration with domain defaults
 */
export const mergeConfigurations = (
  domainConfig: Partial<DomainConfig>,
  userConfig: Partial<DomainConfig>
): DomainConfig => {
  return {
    attributePrefixes: { ...domainConfig.attributePrefixes, ...userConfig.attributePrefixes },
    filteringRules: { ...domainConfig.filteringRules, ...userConfig.filteringRules },
    ignoredAttributes: userConfig.ignoredAttributes || domainConfig.ignoredAttributes || [],
    layoutConfig: { ...domainConfig.layoutConfig, ...userConfig.layoutConfig },
    searchConfig: { ...domainConfig.searchConfig, ...userConfig.searchConfig },
    virtualizationConfig: { ...domainConfig.virtualizationConfig, ...userConfig.virtualizationConfig },
  } as DomainConfig;
};
