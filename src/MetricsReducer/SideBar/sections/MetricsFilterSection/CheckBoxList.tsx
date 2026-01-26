import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type RuleGroupLabel } from 'MetricsReducer/SideBar/sections/MetricsFilterSection/rule-group-labels';
import { getSharedListStyles } from 'MetricsReducer/SideBar/sections/sharedListStyles';

import { CheckboxWithCount } from './CheckboxWithCount';
import { type MetricsFilterSectionState } from './MetricsFilterSection';

type CheckBoxListProps = {
  groups: MetricsFilterSectionState['groups'];
  selectedGroups: MetricsFilterSectionState['selectedGroups'];
  onSelectionChange: (newGroups: MetricsFilterSectionState['selectedGroups']) => void;
};

export function CheckBoxList({ groups, selectedGroups, onSelectionChange }: Readonly<CheckBoxListProps>) {
  const styles = useStyles2(getSharedListStyles);

  return (
    <>
      <div className={styles.listHeader}>
        <div>{t('checkbox-list.selected-count', '{{count}} selected', { count: selectedGroups.length })}</div>
        <Button variant="secondary" fill="text" onClick={() => onSelectionChange([])} disabled={!selectedGroups.length}>
          {t('checkbox-list.clear', 'clear')}
        </Button>
      </div>

      {!groups.length && <div className={styles.noResults}>{t('checkbox-list.no-results', 'No results.')}</div>}

      {groups.length > 0 && (
        <ul className={styles.list} data-testid="checkbox-filters-list" data-sensitive>
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
