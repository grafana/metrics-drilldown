import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { CheckboxWithCount } from './CheckboxWithCount';
import { type MetricsFilterSectionState } from './MetricsFilterSection';

export function CheckBoxList({
  items,
  selectedValues,
  onSelectionChange,
}: {
  items: MetricsFilterSectionState['groups'];
  selectedValues: MetricsFilterSectionState['selectedFilters'];
  onSelectionChange: (filters: string[]) => void;
}) {
  const styles = useStyles2(getStyles);

  if (!items.length) {
    return <div className={styles.noResults}>No results</div>;
  }

  return (
    <>
      <div className={styles.checkboxListHeader}>
        <div>{selectedValues.length} selected</div>
        <Button variant="secondary" fill="text" onClick={() => onSelectionChange([])} disabled={!selectedValues.length}>
          clear
        </Button>
      </div>
      <ul className={styles.checkboxList} data-testid="checkbox-filters-list">
        {items.map((item) => (
          <li key={item.value} className={styles.checkboxItem}>
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
          </li>
        ))}
      </ul>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    checkboxListHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      margin: theme.spacing(0),
      padding: theme.spacing(0, 0, 0, 1),
    }),
    checkboxList: css({
      height: '100%',
      margin: 0,
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
