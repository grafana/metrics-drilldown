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
  onSelectionChange: (newGroups: MetricsFilterSectionState['selectedGroups']) => void;
}) {
  const styles = useStyles2(getStyles);

  const handleClearFilters = () => {
    // We don't need to track when filters are cleared
    onSelectionChange([]);
  };

  return (
    <>
      <div className={styles.checkboxListHeader}>
        <div>{selectedGroups.length} selected</div>
        <Button variant="secondary" fill="text" onClick={handleClearFilters} disabled={!selectedGroups.length}>
          clear
        </Button>
      </div>

      {!groups.length && <div className={styles.noResults}>No results.</div>}

      {groups.length > 0 && (
        <ul className={styles.checkboxList} data-testid="checkbox-filters-list">
          {groups.map((group) => (
            <li key={group.value} className={styles.checkboxItem}>
              <CheckboxWithCount
                label={group.label}
                count={group.count}
                checked={selectedGroups.some((g) => g.value === group.value)}
                onChange={(e) => {
                  const newGroups = e.currentTarget.checked
                    ? [...selectedGroups, { label: group.label, value: group.value }]
                    : selectedGroups.filter((v) => v.value !== group.value);

                  onSelectionChange(newGroups);
                }}
              />
            </li>
          ))}
        </ul>
      )}
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
      padding: theme.spacing(0, 1, 1, 1),
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
      padding: theme.spacing(0.5, 0),
    }),
    noResults: css({
      fontStyle: 'italic',
      padding: theme.spacing(0, 1, 1, 1),
    }),
  };
}
