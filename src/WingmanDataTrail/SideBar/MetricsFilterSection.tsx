import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Input, Spinner, Switch, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState, type KeyboardEvent } from 'react';

import { CheckboxWithCount } from './CheckboxWithCount';

type MetricsFilterSectionProps = {
  title: string;
  items: Array<{ label: string; value: string; count: number }>;
  hideEmpty: boolean;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  loading: boolean;
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

  const filteredList = useMemo(() => {
    const filters: Array<(item: { label: string; value: string; count: number }) => boolean> = [];

    if (hideEmpty) {
      filters.push((item) => item.count > 0);
    }

    filters.push((item) => item.label.toLowerCase().includes(searchValue.toLowerCase()));

    return items.filter((item) => filters.every((filter) => filter(item)));
  }, [hideEmpty, items, searchValue]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setSearchValue('');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h5>{title}</h5>
        <div className={styles.switchContainer} data-testid="switch">
          <span className={styles.switchLabel}>Hide empty</span>
          <Switch value={hideEmpty} onChange={(e) => setHideEmpty(e.currentTarget.checked)} />
        </div>

        <Input
          className={styles.search}
          prefix={<Icon name="search" />}
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          onKeyDown={onKeyDown}
        />

        <div className={styles.checkboxListHeader}>
          <div>{selectedValues.length} selected</div>
          <Button
            className={styles.clearButton}
            variant="secondary"
            fill="text"
            onClick={() => onSelectionChange([])}
            disabled={!selectedValues.length}
          >
            clear
          </Button>
        </div>
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

  if (!filteredList.length) {
    return <div className={styles.noResults}>No results</div>;
  }

  return (
    <div className={styles.checkboxList}>
      {filteredList.map((item) => (
        <div key={item.value} className={styles.checkboxItem}>
          <CheckboxWithCount
            label={item.label}
            count={item.count}
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
    container: css({
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      '& h5': {
        marginBottom: '0',
        paddingBottom: '0',
      },
    }),
    header: css({
      paddingTop: theme.spacing(1),
    }),
    switchContainer: css({
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }),
    switchLabel: css({
      fontSize: '14px',
      color: theme.colors.text.primary,
    }),
    search: css({
      marginBottom: 0,
      padding: '0 4px',
    }),
    checkboxList: css({
      height: '100%',
      padding: `0 ${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)}`,
      overflowY: 'auto',
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
    checkboxListHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      padding: `0 ${theme.spacing(1)}`,
    }),
    clearButton: css({}),
    checkboxItem: css({
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      padding: `${theme.spacing(0.5)} 0`,
    }),
    noResults: css({
      fontStyle: 'italic',
      marginTop: theme.spacing(2),
    }),
  };
}
