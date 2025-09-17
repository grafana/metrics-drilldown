import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Combobox, Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import React, { useEffect, useMemo } from 'react';

interface AttributePrefixConfig {
  span?: string;
  resource?: string;
  event?: string;
  [key: string]: string | undefined;
}

interface SearchConfig {
  enabled?: boolean;
  maxOptions?: number;
  caseSensitive?: boolean;
  searchFields?: Array<'label' | 'value'>;
}

export interface GroupBySelectorProps {
  options: Array<SelectableValue<string>>;
  value?: string;
  onChange: (label: string, ignore?: boolean) => void;
  showAll?: boolean;
  attributePrefixes?: AttributePrefixConfig;
  fieldLabel?: string;
  selectPlaceholder?: string;
  ignoredAttributes?: string[];
  searchConfig?: SearchConfig;
}

const DEFAULT_ALL_OPTION = 'All';

const removeAttributePrefixes = (
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

export function GroupBySelector(props: Readonly<GroupBySelectorProps>) {
  const {
    options = [],
    value,
    onChange,
    showAll = false,
    attributePrefixes = {},
    fieldLabel = 'Group by',
    selectPlaceholder = 'Other attributes',
    ignoredAttributes = [],
  } = props;

  const styles = useStyles2(getStyles);

  // Single memoized options processing
  const processedOptions = useMemo(() => {
    const filtered = options
      .filter((opt) => opt.value && opt.value !== '$__all' && !ignoredAttributes.includes(opt.value))
      .map((opt) => ({
        label: removeAttributePrefixes(opt.label ?? (opt.value as string), attributePrefixes),
        value: opt.value as string,
      }));

    return showAll ? [{ label: DEFAULT_ALL_OPTION, value: DEFAULT_ALL_OPTION }, ...filtered] : filtered;
  }, [options, showAll, ignoredAttributes, attributePrefixes]);

  // Single default value calculation
  const defaultValue = processedOptions[0]?.value;
  const effectiveValue = value || defaultValue;

  // Auto-select default on mount or when options change
  useEffect(() => {
    if (!value && defaultValue) {
      onChange(defaultValue, true);
    }
  }, [defaultValue, value, onChange]);

  const useRadios = processedOptions.length <= 4;

  return (
    <Field label={fieldLabel} data-testid="breakdown-label-selector">
      <div className={styles.container}>
        {useRadios ? (
          <RadioButtonGroup
            data-testid="group-by-selector-radio-group"
            options={processedOptions}
            value={effectiveValue}
            onChange={onChange}
          />
        ) : (
          <div className={styles.selectContainer} id="group-by-selector">
            <Combobox
              id="group-by-selector"
              value={effectiveValue && processedOptions.some((x) => x.value === effectiveValue) ? effectiveValue : null}
              placeholder={selectPlaceholder}
              options={processedOptions}
              onChange={(selected) => {
                const newSelected = selected?.value || defaultValue || '';
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
