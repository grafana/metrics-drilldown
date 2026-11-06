import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';
import React, { type ReactNode } from 'react';

import { type RuleGroupLabel } from 'MetricsReducer/SideBar/sections/MetricsFilterSection/rule-group-labels';
import { getSharedListStyles } from 'MetricsReducer/SideBar/sections/sharedListStyles';

import { CheckboxWithCount } from './CheckboxWithCount';
import { type MetricsFilterSectionState } from './MetricsFilterSection';

type CheckBoxListProps = {
  groups: MetricsFilterSectionState['groups'];
  selectedGroups: MetricsFilterSectionState['selectedGroups'];
  onSelectionChange: (newGroups: MetricsFilterSectionState['selectedGroups']) => void;
  /** Extra filter listed first; counts towards the selection and is reset by "clear". */
  control?: { node: ReactNode; active: boolean; clear: () => void };
};

export function CheckBoxList({ groups, selectedGroups, onSelectionChange, control }: Readonly<CheckBoxListProps>) {
  const styles = useStyles2(getSharedListStyles);
  const selectedCount = selectedGroups.length + (control?.active ? 1 : 0);

  const onClear = () => {
    if (selectedGroups.length) {
      onSelectionChange([]);
    }
    if (control?.active) {
      control.clear();
    }
  };

  return (
    <>
      <div className={styles.listHeader}>
        <div>{t('checkbox-list.selected-count', '{{count}} selected', { count: selectedCount })}</div>
        <Button variant="secondary" fill="text" onClick={onClear} disabled={!selectedCount}>
          {t('checkbox-list.clear', 'clear')}
        </Button>
      </div>

      {!groups.length && !control && (
        <div className={styles.noResults}>{t('checkbox-list.no-results', 'No results.')}</div>
      )}

      {(groups.length > 0 || control) && (
        <ul className={styles.list} data-testid="checkbox-filters-list">
          {control && <li className={styles.listItem}>{control.node}</li>}
          {groups.map((group) => (
            <li key={group.value} className={styles.listItem}>
              <CheckboxWithCount
                label={group.label}
                count={group.count}
                checked={selectedGroups.some((g) => g.value === group.value)}
                onChange={(e) => {
                  const newGroups = e.currentTarget.checked
                    ? [...selectedGroups, { label: group.label as RuleGroupLabel, value: group.value }]
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
