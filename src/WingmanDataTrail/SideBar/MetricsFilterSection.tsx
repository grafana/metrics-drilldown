import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, Spinner, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState, type KeyboardEvent } from 'react';

import { CheckBoxList } from './CheckBoxList';

export type MetricsFilterSectionProps = {
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

  const [searchValue, setSearchValue] = useState('');

  const filteredList = useMemo(() => {
    const filters: Array<(item: { label: string; value: string; count: number }) => boolean> = [];

    filters.push((item) => item.label.toLowerCase().includes(searchValue.toLowerCase()));

    return items.filter((item) => filters.every((filter) => filter(item)));
  }, [items, searchValue]);

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
        <span className={styles.count}>({filteredList.length})</span>
      </h5>

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
      padding: theme.spacing(2),
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    header: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      marginBottom: theme.spacing(1),
      paddingBottom: theme.spacing(1),
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
