import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Combobox, Field, RadioButtonGroup, useStyles2, useTheme2 } from '@grafana/ui';
import { useResizeObserver } from '@react-aria/utils';
import React, { useMemo, useRef, useState } from 'react';


import {
  type DomainConfig,
  type FilterContext,
  type GroupBySelectorProps,
} from './types';
import {
  createDefaultGroupBySelectorConfig,
  filteredOptions,
  getModifiedSelectOptions,
  mergeConfigurations,
  processRadioAttributes,
} from './utils';

const DEFAULT_ADDITIONAL_WIDTH_PER_ITEM = 40;
const DEFAULT_WIDTH_OF_OTHER_ATTRIBUTES = 180;
const DEFAULT_ALL_OPTION = 'All';

export function GroupBySelector(props: Readonly<GroupBySelectorProps>) {
  const {
    // Core props
    options,
    radioAttributes,
    value,
    onChange,
    showAll = false,

    // State data
    filters = [],
    currentMetric,
    initialGroupBy,

    // Display configuration
    attributePrefixes = {},
    fieldLabel = 'Group by',
    selectPlaceholder = 'Other attributes',

    // Filtering rules
    filteringRules = {},
    ignoredAttributes = [],

    // Layout and sizing
    layoutConfig = {},

    // Advanced options
    searchConfig = {},
    virtualizationConfig = {},
  } = props;
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { fontSize } = theme.typography;

  // Internal state
  const [availableWidth, setAvailableWidth] = useState<number>(0);
  const controlsContainer = useRef<HTMLDivElement>(null);
  const previousRadioAttributesRef = useRef<string[]>([]);
  const hasInitializedRef = useRef<boolean>(false);

  // Merge configurations with defaults
  const domainDefaults = createDefaultGroupBySelectorConfig();
  const config: DomainConfig = mergeConfigurations(domainDefaults, {
    attributePrefixes,
    filteringRules,
    ignoredAttributes,
    layoutConfig,
    searchConfig,
    virtualizationConfig,
  });

  // Resize observer for responsive radio buttons
  useResizeObserver({
    ref: controlsContainer,
    onResize: () => {
      const element = controlsContainer.current;
      if (element && config.layoutConfig.enableResponsiveRadioButtons) {
        setAvailableWidth(element.clientWidth);
      }
    },
  });

  // Create filter context
  const filterContext: FilterContext = {
    filters,
    currentMetric,
    availableOptions: options,
  };

  // Process radio attributes
  const radioOptions = !config.layoutConfig.enableResponsiveRadioButtons
    ? radioAttributes.map((attribute) => ({
        label: config.attributePrefixes.span?.length
          ? attribute.replace(config.attributePrefixes.span, '')
          : attribute.replace(config.attributePrefixes.resource || '', ''),
        text: attribute,
        value: attribute,
      }))
    : processRadioAttributes(
        radioAttributes,
        options,
        filters,
        config.filteringRules,
        filterContext,
        config.attributePrefixes,
        fontSize,
        availableWidth,
        config.layoutConfig.additionalWidthPerItem || DEFAULT_ADDITIONAL_WIDTH_PER_ITEM,
        config.layoutConfig.widthOfOtherAttributes || DEFAULT_WIDTH_OF_OTHER_ATTRIBUTES
      );

  // Show all radio options - no artificial limit or special treatment of labels
  const limitedRadioOptions = radioOptions;

  // Process other attributes (those not in limited radio buttons)
  const optionsNotInRadio = options.filter(
    (option) => !limitedRadioOptions.find((ro) => ro.value === option.value?.toString())
  );
  const otherAttrOptions = filteredOptions(optionsNotInRadio, '', config.searchConfig);

  // Get modified select options
  const baseOptions = getModifiedSelectOptions(otherAttrOptions, config.ignoredAttributes, config.attributePrefixes);

  // Add "All" option to dropdown if showAll is true and no radio buttons are shown
  const modifiedSelectOptions = showAll && limitedRadioOptions.length === 0
    ? [{ label: DEFAULT_ALL_OPTION, value: DEFAULT_ALL_OPTION }, ...baseOptions]
    : baseOptions;

  // Determine default value
  const defaultValue = initialGroupBy ?? (showAll ? DEFAULT_ALL_OPTION : limitedRadioOptions[0]?.value ?? modifiedSelectOptions[0]?.value);

  // Check if radio attributes have changed (to trigger re-initialization)
  const radioAttributesChanged = useMemo(() => {
    const current = radioAttributes.join(',');
    const previous = previousRadioAttributesRef.current.join(',');
    if (current !== previous) {
      previousRadioAttributesRef.current = [...radioAttributes];
      return true;
    }
    return false;
  }, [radioAttributes]);

  // Check if current value exists in filters (indicates it might be stale)
  const valueExistsInFilters = useMemo(() => {
    return filters.some((f) => f.key === value);
  }, [filters, value]);

  // Determine if we should auto-update (derived state instead of useEffect)
  const shouldAutoUpdate = useMemo(() => {
    // Don't auto-update if we already have a valid value and haven't detected changes
    if (value && !radioAttributesChanged && !valueExistsInFilters) {
      return false;
    }

    // Auto-update if we don't have a value, or if conditions suggest we should
    return !value || radioAttributesChanged || valueExistsInFilters;
  }, [value, radioAttributesChanged, valueExistsInFilters]);

  // Handle the auto-update logic in render (instead of useEffect)
  const effectiveValue = useMemo(() => {
    if (defaultValue && shouldAutoUpdate && !hasInitializedRef.current) {
      // Mark as initialized to prevent repeated auto-updates
      hasInitializedRef.current = true;
      // Trigger the onChange in the next render cycle
      setTimeout(() => onChange(defaultValue, true), 0);
      return defaultValue;
    }

    // Reset initialization flag when radio attributes change
    if (radioAttributesChanged) {
      hasInitializedRef.current = false;
    }

    return value;
  }, [value, defaultValue, shouldAutoUpdate, radioAttributesChanged, onChange]);

  // Show All option
  const showAllOption = showAll ? [{ label: DEFAULT_ALL_OPTION, value: DEFAULT_ALL_OPTION }] : [];
  const defaultOnChangeValue = showAll ? DEFAULT_ALL_OPTION : '';
  const isAllSelected = value && value === DEFAULT_ALL_OPTION;

  return (
    <Field label={fieldLabel}>
      <div ref={controlsContainer} className={styles.container}>
        {limitedRadioOptions.length > 0 && (
            <RadioButtonGroup
              className={!isAllSelected ? styles.hasValueSelected : ''}
              options={[...showAllOption, ...limitedRadioOptions]}
              value={effectiveValue}
              onChange={onChange}
              fullWidth={true}
            />
        )}
        {modifiedSelectOptions.length > 0 && (
          <div className={!isAllSelected ? styles.hasValueSelected : ''}>
            <Combobox
              value={effectiveValue && modifiedSelectOptions.some((x) => x.value === effectiveValue) ? effectiveValue : null}
              placeholder={selectPlaceholder}
              options={modifiedSelectOptions.filter(opt => opt.value !== undefined) as Array<{label?: string, value: string}>}
              onChange={(selected) => {
                const newSelected = (selected?.value as string) ?? defaultOnChangeValue;
                onChange(newSelected);
              }}
              isClearable
            />
          </div>
        )}
      </div>
    </Field>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    select: css({
      maxWidth: theme.spacing(22),
    }),
    container: css({
      display: 'flex',
      gap: theme.spacing(1),
      width: '100%',
      alignItems: 'flex-start',
    }),
    hasValueSelected: css({
      flexGrow: 1,
    }),
  };
}
