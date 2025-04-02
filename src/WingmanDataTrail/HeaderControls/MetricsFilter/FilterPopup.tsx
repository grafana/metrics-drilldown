import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Input, Stack, Switch, useStyles2 } from '@grafana/ui';
import React, { useCallback, useMemo, useState, type KeyboardEvent } from 'react';

import { CheckboxWithCount } from '../../SideBar/CheckboxWithCount';
interface FilterPopupProps {
  items: Array<{ label: string; value: string; count: number }>;
  selectedGroups: string[];
  onClickOk: (selectedValues: string[]) => void;
  onClickCancel: () => void;
}

export const FilterPopup = ({ items, selectedGroups, onClickOk, onClickCancel }: FilterPopupProps) => {
  const styles = useStyles2(getStyles);

  const [hideEmpty, setHideEmpty] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>(selectedGroups);

  const filteredItems = useMemo(() => {
    const filters: Array<(item: { label: string; value: string; count: number }) => boolean> = [];

    if (hideEmpty) {
      filters.push((item) => item.count > 0);
    }

    filters.push((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()));

    return items.filter((item) => filters.every((filter) => filter(item)));
  }, [hideEmpty, items, searchQuery]);

  const handleValueSelect = useCallback((value: string) => {
    setSelectedValues((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      }
      return [...prev, value];
    });
  }, []);

  const handleOk = useCallback(() => {
    onClickOk(selectedValues);
  }, [selectedValues, onClickOk]);

  const handleCancel = useCallback(() => {
    onClickCancel();
  }, [onClickCancel]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.switchContainer} data-testid="switch">
        <span className={styles.switchLabel}>Hide empty</span>
        <Switch value={hideEmpty} onChange={(e) => setHideEmpty(e.currentTarget.checked)} />
      </div>

      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.currentTarget.value)}
        className={styles.searchInput}
        prefix={<Icon name="search" />}
        placeholder="Search..."
        onKeyDown={onKeyDown}
      />

      <div className={styles.checkboxListHeader}>
        <div>{selectedValues.length} selected</div>
        <Button
          className={styles.clearButton}
          variant="secondary"
          fill="text"
          onClick={() => setSelectedValues([])}
          disabled={!selectedValues.length}
        >
          clear
        </Button>
      </div>

      <div className={styles.valuesList}>
        {!filteredItems.length ? (
          <div className={styles.noResults}>No results</div>
        ) : (
          filteredItems.map((i) => (
            <CheckboxWithCount
              key={i.value}
              label={i.label}
              count={i.count}
              checked={selectedValues.includes(i.value)}
              onChange={() => handleValueSelect(i.value)}
            />
          ))
        )}
      </div>

      <div className={styles.footer}>
        <Stack direction="row" gap={1}>
          <Button onClick={handleOk} variant="primary" size="sm">
            Apply
          </Button>
          <Button onClick={handleCancel} variant="secondary" size="sm">
            Cancel
          </Button>
        </Stack>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.radius.default};
      padding: ${theme.spacing(2, 3)};
      width: 320px;
    `,
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
    searchInput: css`
      margin-bottom: ${theme.spacing(2)};
      background: ${theme.colors.background.secondary};
    `,
    checkboxListHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
      padding: `0 ${theme.spacing(1)}`,
      borderBottom: `1px solid ${theme.colors.border.medium}`,
    }),
    clearButton: css({}),
    valuesList: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: ${theme.spacing(2)};
      padding: ${theme.spacing(1)} 0;
    `,
    footer: css`
      border-top: 1px solid ${theme.colors.border.medium};
      padding-top: ${theme.spacing(2)};
      justify-content: flex-start;
    `,
    noResults: css`
      font-style: italic;
      // margin-top: ${theme.spacing(2)}
    `,
  };
};
