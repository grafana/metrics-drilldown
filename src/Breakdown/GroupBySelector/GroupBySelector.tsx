import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Combobox, Field, RadioButtonGroup, useStyles2, useTheme2 } from '@grafana/ui';
import { useResizeObserver } from '@react-aria/utils';
import { debounce } from 'lodash';
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
  // add a small debounce to the onResize
  useResizeObserver({
    ref: controlsContainer,
    onResize: debounce(() => {
      const element = controlsContainer.current;
      if (element) {
          // requestAnimationFrame to avoid excessive re-renders
          requestAnimationFrame(() => {
            setAvailableWidth(element.clientWidth);
          });
        }
    }, 100),
  });

  // Process radio attributes (memoized for expensive calculations)
  const radioOptions = useMemo(() => {
    // Create filter context inside useMemo to avoid dependency issues
    const filterContext: FilterContext = {
      filters,
      currentMetric,
      availableOptions: options,
    };

    return processRadioAttributes(
          radioAttributes,
          options,
          config.filteringRules,
          filterContext,
          {
            attributePrefixes: config.attributePrefixes,
            fontSize,
            availableWidth,
            additionalWidthPerItem: config.layoutConfig.additionalWidthPerItem || DEFAULT_ADDITIONAL_WIDTH_PER_ITEM,
            widthOfOtherAttributes: config.layoutConfig.widthOfOtherAttributes || DEFAULT_WIDTH_OF_OTHER_ATTRIBUTES,
            includeAllOptionInWidth: showAll,
            allOptionLabel: DEFAULT_ALL_OPTION,
          }
        );
  }, [radioAttributes, config.attributePrefixes, options, filters, config.filteringRules, currentMetric, fontSize, availableWidth, config.layoutConfig.additionalWidthPerItem, config.layoutConfig.widthOfOtherAttributes, showAll]);

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

  // Check if radio attributes have changed (no memoization, no side effects)
  const current = radioAttributes.join(',');
  const previous = previousRadioAttributesRef.current.join(',');
  const radioAttributesChanged = current !== previous;
  if (radioAttributesChanged) {
    previousRadioAttributesRef.current = [...radioAttributes];
  }

  // Check if current value exists in filters (simple operation, no memoization needed)
  const valueExistsInFilters = filters.some((f) => f.key === value);

  // Determine if we should auto-update
  const shouldAutoUpdate = !value || radioAttributesChanged || valueExistsInFilters;

  // Handle the auto-update logic (no side effects in useMemo)
  let effectiveValue = value;
  if (defaultValue && shouldAutoUpdate && !hasInitializedRef.current) {
    // Mark as initialized to prevent repeated auto-updates
    hasInitializedRef.current = true;
    // Trigger the onChange in the next render cycle
    setTimeout(() => onChange(defaultValue, true), 0);
    effectiveValue = defaultValue;
  }

  // Reset initialization flag when radio attributes change
  if (radioAttributesChanged) {
    hasInitializedRef.current = false;
  }

  // Show All option
  const showAllOption = showAll ? [{ label: DEFAULT_ALL_OPTION, value: DEFAULT_ALL_OPTION }] : [];
  const defaultOnChangeValue = showAll ? DEFAULT_ALL_OPTION : '';

  return (
    <Field label={fieldLabel}>
      <div ref={controlsContainer} className={styles.container}>
        {limitedRadioOptions.length > 0 && (
            <RadioButtonGroup
              options={[...showAllOption, ...limitedRadioOptions]}
              value={effectiveValue}
              onChange={onChange}
            />
        )}
        {modifiedSelectOptions.length > 0 && (
          <div className={styles.selectContainer}>
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
    selectContainer: css({
      minWidth: 100,
    }),
  };
}
