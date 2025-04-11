import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { CheckboxWithCount } from './CheckboxWithCount';
import { type MetricsFilterSectionState } from './MetricsFilterSection';

export function CheckBoxList({
  groups,
  selectedGroups,
  onSelectionChange,
}: {
  groups: MetricsFilterSectionState['groups'];
  selectedGroups: MetricsFilterSectionState['selectedGroups'];
  onSelectionChange: (filters: string[]) => void;
}) {
  const styles = useStyles2(getStyles);

  if (!groups.length) {
    return <div className={styles.noResults}>No results</div>;
  }

  return (
    <>
      <div className={styles.checkboxListHeader}>
        <div>{selectedGroups.length} selected</div>
        <Button variant="secondary" fill="text" onClick={() => onSelectionChange([])} disabled={!selectedGroups.length}>
          clear
        </Button>
      </div>
      <ul className={styles.checkboxList} data-testid="checkbox-filters-list">
        {groups.map((group) => (
          <li key={group.value} className={styles.checkboxItem}>
            <CheckboxWithCount
              label={group.label}
              count={group.count}
              checked={selectedGroups.includes(group.value)}
              onChange={(e) => {
                const newValues = e.currentTarget.checked
                  ? [...selectedGroups, group.value]
                  : selectedGroups.filter((v) => v !== group.value);
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
