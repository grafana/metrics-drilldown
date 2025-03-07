import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Field, FieldSet, Icon, Input, Spinner, Switch, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useState, type KeyboardEvent } from 'react';

type MetricsFilterSectionProps = {
  title: string;
  items: Array<{ label: string; value: string; count: number }>;
  hideEmpty: boolean;
  searchValue: string;
  selectedValues: string[];
  onSearchChange: (value: string) => void;
  onSelectionChange: (values: string[]) => void;
  loading: boolean;
};

const CheckboxWithCount = ({
  label,
  count,
  value,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  value: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.checkboxWrapper}>
      <Checkbox label={label} value={checked} onChange={onChange} />
      <span className={styles.count}>({count})</span>
    </div>
  );
};

export function MetricsFilterSection({
  title,
  items,
  searchValue,
  selectedValues,
  onSearchChange,
  onSelectionChange,
  loading,
}: MetricsFilterSectionProps) {
  const styles = useStyles2(getStyles);

  // Local state for immediate input value
  const [inputValue, setInputValue] = useState(searchValue);
  const [hideEmpty, setHideEmpty] = useState(true);

  // Add debounced search
  const debouncedSearch = useCallback(
    (value: string) => {
      const timeoutId = setTimeout(() => {
        onSearchChange(value);
      }, 250);
      return () => clearTimeout(timeoutId);
    },
    [onSearchChange]
  );

  // Update debounced search when input changes
  useEffect(() => {
    const cleanup = debouncedSearch(inputValue);
    return cleanup;
  }, [inputValue, debouncedSearch]);

  // Update local input when searchValue prop changes
  useEffect(() => {
    setInputValue(searchValue);
  }, [searchValue]);

  // Remove the "All" option - just use the items directly
  const filteredList = items.filter((item) => {
    const matchesSearch = item.label.toLowerCase().includes(searchValue.toLowerCase());
    if (hideEmpty) {
      return matchesSearch && item.count > 0;
    }
    return matchesSearch;
  });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue('');
    }
  };

  return (
    <FieldSet label={title} className={styles.fieldSetTitle}>
      <div className={styles.fieldSetContent}>
        <div className={styles.controlsRow}>
          <Field className={styles.field}>
            <div className={styles.switchContainer}>
              <span className={styles.switchLabel}>Hide empty</span>
              <Switch value={hideEmpty} onChange={(e) => setHideEmpty(e.currentTarget.checked)} />
            </div>
          </Field>
          <Field className={styles.field}>
            <Input
              prefix={<Icon name="search" />}
              placeholder="Search..."
              value={inputValue}
              onChange={(e) => setInputValue(e.currentTarget.value)}
              onKeyDown={onKeyDown}
            />
          </Field>
        </div>
        {loading && <Spinner inline />}
        {!loading && (
          <CheckBoxList
            filteredList={filteredList}
            selectedValues={selectedValues}
            onSelectionChange={onSelectionChange}
          />
        )}
      </div>
    </FieldSet>
  );
}

function CheckBoxList({
  filteredList,
  selectedValues,
  onSelectionChange,
}: {
  filteredList: MetricsFilterSectionProps['items'];
  selectedValues: MetricsFilterSectionProps['selectedValues'];
  onSelectionChange: MetricsFilterSectionProps['onSelectionChange'];
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.checkboxList}>
      {filteredList.map((item) => (
        <div key={item.value} className={styles.checkboxItem}>
          <CheckboxWithCount
            label={item.label}
            count={item.count}
            value={item.value}
            checked={selectedValues.includes(item.value)}
            onChange={(e) => {
              const newValues = e.currentTarget.checked
                ? [...selectedValues, item.value]
                : selectedValues.filter((v) => v !== item.value);
              onSelectionChange(newValues);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    fieldSetTitle: css({
      '& > legend': {
        fontSize: theme.typography.h5.fontSize + ' !important',
        fontWeight: theme.typography.h5.fontWeight + ' !important',
        marginBottom: '0 !important',
        paddingBottom: '0 !important',
      },
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      '& > div': {
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '250px',
      },
      padding: '0 !important',
      margin: '0 !important',
    }),
    fieldSetContent: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      height: 'auto',
      overflow: 'hidden',
      '& .css-1n4u71h-Label': {
        fontSize: '14px !important',
      },
      '& > legend': {
        fontSize: theme.typography.body.fontSize + ' !important',
        fontWeight: theme.typography.body.fontWeight + ' !important',
      },
      '& > div': {
        marginBottom: 0,
      },
      '& > div:nth-child(2)': {
        marginBottom: theme.spacing(0.5),
      },
    }),
    checkboxList: css({
      overflowY: 'auto',
      flexGrow: 0,
      paddingRight: theme.spacing(1),
      maxHeight: '210px',
      marginTop: theme.spacing(0.5),
      '& .css-1n4u71h-Label': {
        fontSize: '14px !important',
      },
      '&::-webkit-scrollbar': {
        '-webkit-appearance': 'none',
        width: '7px',
      },
      '&::-webkit-scrollbar-thumb': {
        borderRadius: '4px',
        backgroundColor: theme.colors.secondary.main,
        '-webkit-box-shadow': `0 0 1px ${theme.colors.secondary.shade}`,
      },
    }),
    switchContainer: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    }),
    switchLabel: css({
      fontSize: '14px',
      color: theme.colors.text.primary,
    }),
    checkboxWrapper: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      '& label': {
        fontSize: '14px !important',
      },
    }),
    count: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
    field: css({
      marginBottom: '0 !important',
    }),
    controlsRow: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    checkboxItem: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      padding: `${theme.spacing(0.5)} 0`,
    }),
  };
}
