import { type SelectableValue } from '@grafana/data';

import { type AttributePrefixConfig, type SearchConfig } from './types';

// (removed createAttributeFilter and processRadioAttributes; no width-based logic)

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

// (removed deriveRadioAttributesFromOptions; radios are decided internally)

// (removed createDefaultGroupBySelectorConfig)

// (removed mergeConfigurations)
