import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, Spinner, Switch, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState, type KeyboardEvent } from 'react';

import { CheckBoxList } from './CheckBoxList';

export type MetricsFilterSectionProps = {
  title: string;
  items: Array<{ label: string; value: string; count: number }>;
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
      <h5 className={styles.header}>
        {title}
        <span className={styles.count}>({loading ? '0' : filteredList.length})</span>
      </h5>
      <div className={styles.switchContainer}>
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

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      width: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      overflowY: 'hidden',
      background: theme.colors.background.primary,
    }),
    header: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      marginBottom: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    }),
    switchContainer: css({
      marginBottom: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }),
    switchLabel: css({
      fontSize: '14px',
      color: theme.colors.text.primary,
    }),
    count: css({
      display: 'inline-block',
      color: theme.colors.text.secondary,
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
    }),
    search: css({
      flexBasis: '32px',
      flexShrink: 0,
      marginBottom: theme.spacing(1),
    }),
  };
}
