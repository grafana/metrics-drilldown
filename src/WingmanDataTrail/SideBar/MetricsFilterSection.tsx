import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Field, FieldSet, Icon, Input, Spinner, Switch, useStyles2 } from '@grafana/ui';
import React, { useState, type KeyboardEvent } from 'react';

type MetricsFilterSectionProps = {
  title: string;
  items: Array<{ label: string; value: string; count: number }>;
  hideEmpty: boolean;
  selectedValues: string[];
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
  // Create a combined label with the count
  const combinedLabel = `${label} `;

  return (
    <div className={styles.checkboxWrapper}>
      <Checkbox label={combinedLabel} value={checked} onChange={onChange} />
      <span className={styles.count}>({count})</span>
    </div>
  );
};

export function MetricsFilterSection({
  title,
  items,
  selectedValues,
  onSelectionChange,
  loading,
}: MetricsFilterSectionProps) {
  const styles = useStyles2(getStyles);

  const [hideEmpty, setHideEmpty] = useState(true);
  const [searchValue, setSearchValue] = useState('');

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
      setSearchValue('');
    }
  };

  return (
    <FieldSet label={title} className={styles.fieldSetTitle}>
      <div className={styles.fieldSetContent}>
        <Field>
          <div className={styles.switchContainer}>
            <span className={styles.switchLabel}>Hide empty</span>
            <Switch value={hideEmpty} onChange={(e) => setHideEmpty(e.currentTarget.checked)} />
          </div>
        </Field>
        <Field>
          <Input
            prefix={<Icon name="search" />}
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
        </Field>
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
      alignItems: 'center',
      width: '100%',
      '& label': {
        fontSize: '14px !important',
      },
    }),
    count: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(0.5),
      display: 'inline-block',
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
      alignItems: 'center',
      width: '100%',
      padding: `${theme.spacing(0.5)} 0`,
    }),
  };
}
