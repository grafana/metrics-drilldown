import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Combobox, Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import React, { useMemo, useRef } from 'react';

import { type GroupBySelectorProps } from './types';
import { filteredOptions, getModifiedSelectOptions, removeAttributePrefixes } from './utils';

const DEFAULT_ALL_OPTION = 'All';

function getDefaultForRadios(radioOptions: Array<{ value: string }>, showAll: boolean): string | undefined {
  if (showAll) {
    return DEFAULT_ALL_OPTION;
  }
  return radioOptions[0]?.value ?? undefined;
}

function getDefaultForCombobox(
  comboboxOptions: Array<SelectableValue<string>>,
  showAll: boolean
): string | undefined {
  if (showAll) {
    return DEFAULT_ALL_OPTION;
  }
  return comboboxOptions[0]?.value as string | undefined;
}

function buildKeyForRadios(radioOptions: Array<{ value: string }>): string {
  return `radios:${radioOptions.map((o) => o.value).join('|')}`;
}

function buildKeyForCombobox(comboboxOptions: Array<SelectableValue<string>>): string {
  return `combo:${comboboxOptions.map((o) => o.value).join('|')}`;
}

function isValueInRadios(value: string | undefined, radioOptions: Array<{ value: string }>): boolean {
  return Boolean(value) && radioOptions.some((o) => o.value === value);
}

function isValueInCombobox(
  value: string | undefined,
  comboboxOptions: Array<SelectableValue<string>>
): boolean {
  return Boolean(value) && comboboxOptions.some((o) => o.value === value);
}

function computeEffectiveValue(
  optionsKey: string,
  isValueAvailable: boolean,
  defaultValue: string | undefined,
  currentValue: string | undefined,
  previousOptionsRef: React.MutableRefObject<string>,
  hasInitializedRef: React.MutableRefObject<boolean>,
  onChange: (value: string, skipObserver?: boolean) => void
): string | undefined {
  let effectiveValue = currentValue;
  const optionsChanged = optionsKey !== previousOptionsRef.current;
  if (optionsChanged) {
    previousOptionsRef.current = optionsKey;
    hasInitializedRef.current = false;
  }
  const shouldAutoUpdate = (!currentValue || !isValueAvailable) && !hasInitializedRef.current && defaultValue;
  if (shouldAutoUpdate && defaultValue) {
    hasInitializedRef.current = true;
    setTimeout(() => onChange(defaultValue, true), 0);
    effectiveValue = defaultValue;
  }
  return effectiveValue;
}

export function GroupBySelector(props: Readonly<GroupBySelectorProps>) {
  const {
    // Core props
    options,
    value,
    onChange,
    showAll = false,

    // Display configuration
    attributePrefixes = {},
    fieldLabel = 'Group by',
    selectPlaceholder = 'Other attributes',

    // Option processing
    ignoredAttributes = [],
    searchConfig = {},
  } = props;
  const styles = useStyles2(getStyles);
  const previousOptionsRef = useRef<string>('');
  const hasInitializedRef = useRef<boolean>(false);
  const selectableOptions = useMemo(() => {
    return (options || []).filter((opt) => opt.value && opt.value !== '$__all') as Array<SelectableValue<string>>;
  }, [options]);

  if (selectableOptions.length <= 4) {
    const radioOptions = selectableOptions.map((opt) => ({
      label: removeAttributePrefixes(opt.label ?? (opt.value as string), attributePrefixes),
      value: opt.value as string,
    }));

    const defaultValue = getDefaultForRadios(radioOptions, showAll);
    const currentOptionsKey = buildKeyForRadios(radioOptions);
    const isValueAvailable = isValueInRadios(value, radioOptions);
    const effectiveValue = computeEffectiveValue(
      currentOptionsKey,
      isValueAvailable,
      defaultValue,
      value,
      previousOptionsRef,
      hasInitializedRef,
      onChange
    );

    return (
      <Field label={fieldLabel} data-testid="breakdown-label-selector">
        <div className={styles.container}>
          <RadioButtonGroup
            data-testid="group-by-selector-radio-group"
            options={[
              ...(showAll ? [{ label: DEFAULT_ALL_OPTION, value: DEFAULT_ALL_OPTION }] : []),
              ...radioOptions,
            ]}
            value={effectiveValue}
            onChange={onChange}
          />
        </div>
      </Field>
    );
  }

  const baseOptions = getModifiedSelectOptions(
    filteredOptions(selectableOptions, '', searchConfig),
    ignoredAttributes,
    attributePrefixes
  );
  const comboboxOptions = showAll
    ? ([{ label: DEFAULT_ALL_OPTION, value: DEFAULT_ALL_OPTION }, ...baseOptions] as Array<SelectableValue<string>>)
    : baseOptions;

  const defaultValue = getDefaultForCombobox(comboboxOptions, showAll);
  const currentOptionsKey = buildKeyForCombobox(comboboxOptions);
  const isValueAvailable = isValueInCombobox(value, comboboxOptions);
  const effectiveValue = computeEffectiveValue(
    currentOptionsKey,
    isValueAvailable,
    defaultValue,
    value,
    previousOptionsRef,
    hasInitializedRef,
    onChange
  );

  const defaultOnChangeValue = showAll ? DEFAULT_ALL_OPTION : '';

  return (
    <Field label={fieldLabel} data-testid="breakdown-label-selector">
      <div className={styles.container}>
        {comboboxOptions.length > 0 && (
          <div className={styles.selectContainer} id="group-by-selector">
            <Combobox
              id="group-by-selector"
              value={effectiveValue && comboboxOptions.some((x) => x.value === effectiveValue) ? effectiveValue : null}
              placeholder={selectPlaceholder}
              options={comboboxOptions.filter((opt) => opt.value !== undefined) as Array<{ label?: string; value: string }>}
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
