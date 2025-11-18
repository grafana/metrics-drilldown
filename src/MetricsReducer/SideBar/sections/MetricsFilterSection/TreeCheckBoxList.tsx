import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type RuleGroupLabel } from './rule-group-labels';
import { CheckboxWithCount } from './CheckboxWithCount';
import { type MetricsFilterSectionState } from './MetricsFilterSection';

type TreeCheckBoxListProps = {
  groups: MetricsFilterSectionState['groups'];
  selectedGroups: MetricsFilterSectionState['selectedGroups'];
  expandedPrefixes: Set<string>;
  computedSublevels: Map<string, Array<{ label: string; value: string; count: number }>>;
  onSelectionChange: (newGroups: MetricsFilterSectionState['selectedGroups']) => void;
  onExpandToggle: (prefix: string) => void;
};

export function TreeCheckBoxList({
  groups,
  selectedGroups,
  expandedPrefixes,
  computedSublevels,
  onSelectionChange,
  onExpandToggle,
}: Readonly<TreeCheckBoxListProps>) {
  const styles = useStyles2(getStyles);

  // Helper: Check if parent is directly selected (not children)
  const isParentChecked = (parentValue: string) => {
    return selectedGroups.some((g) => g.value === parentValue);
  };

  // Helper: Get children for a parent
  const getChildren = (parentValue: string) => {
    return computedSublevels.get(parentValue) || [];
  };

  // Handle parent checkbox click
  const handleParentChange = (parent: { label: string; value: string }, checked: boolean) => {
    if (checked) {
      // Add parent, remove any children
      const newGroups = [
        ...selectedGroups.filter((g) => !g.value.startsWith(parent.value + ':')),
        { label: parent.label as RuleGroupLabel, value: parent.value },
      ];
      onSelectionChange(newGroups);
    } else {
      // Remove parent
      const newGroups = selectedGroups.filter((g) => g.value !== parent.value);
      onSelectionChange(newGroups);
    }
  };

  // Handle child checkbox click
  const handleChildChange = (child: { label: string; value: string }, checked: boolean) => {
    const [parentPrefix] = child.value.split(':');

    if (checked) {
      // Add child, remove parent if it exists
      const newGroups = [
        ...selectedGroups.filter((g) => g.value !== parentPrefix),
        { label: child.label as RuleGroupLabel, value: child.value },
      ];
      onSelectionChange(newGroups);
    } else {
      // Remove child
      const newGroups = selectedGroups.filter((g) => g.value !== child.value);
      onSelectionChange(newGroups);
    }
  };

  return (
    <>
      <div className={styles.checkboxListHeader}>
        <div>{selectedGroups.length} selected</div>
        <Button
          variant="secondary"
          fill="text"
          onClick={() => onSelectionChange([])}
          disabled={!selectedGroups.length}
        >
          clear
        </Button>
      </div>

      {!groups.length && <div className={styles.noResults}>No results.</div>}

      {groups.length > 0 && (
        <ul className={styles.checkboxList} data-testid="checkbox-filters-tree">
          {groups.map((group) => {
            const isExpanded = expandedPrefixes.has(group.value);
            const children = getChildren(group.value);
            const hasChildren = children.length > 0 || isExpanded;
            const isChecked = isParentChecked(group.value);

            return (
              <React.Fragment key={group.value}>
                {/* Parent Row */}
                <li className={styles.checkboxItem}>
                  <div className={styles.parentRow}>
                    {/* Expand/Collapse Icon */}
                    <button
                      className={styles.expandButton}
                      onClick={() => onExpandToggle(group.value)}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      data-testid={`expand-${group.value}`}
                    >
                      <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
                    </button>

                    {/* Parent Checkbox */}
                    <CheckboxWithCount
                      label={group.label}
                      count={group.count}
                      checked={isChecked}
                      onChange={(e) => handleParentChange(group, e.currentTarget.checked)}
                    />
                  </div>
                </li>

                {/* Children Rows (if expanded) */}
                {isExpanded && hasChildren && (
                  <ul className={styles.childrenList}>
                    {children.map((child) => (
                      <li key={child.value} className={styles.childItem}>
                        <CheckboxWithCount
                          label={child.label}
                          count={child.count}
                          checked={selectedGroups.some((g) => g.value === child.value)}
                          onChange={(e) => handleChildChange(child, e.currentTarget.checked)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </React.Fragment>
            );
          })}
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
      padding: theme.spacing(0, 0, 0, 1),
    }),
    checkboxList: css({
      height: '100%',
      padding: theme.spacing(0, 1, 1, 1),
      overflowY: 'auto',
      listStyle: 'none',
      margin: 0,
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
      padding: theme.spacing(0.5, 0),
    }),
    parentRow: css({
      display: 'flex',
      alignItems: 'center',
      width: '100%',
    }),
    expandButton: css({
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: theme.spacing(0.5),
      display: 'flex',
      alignItems: 'center',
      color: theme.colors.text.primary,
      minWidth: '24px',
      justifyContent: 'center',
      '&:hover': {
        color: theme.colors.text.maxContrast,
      },
    }),
    childrenList: css({
      listStyle: 'none',
      paddingLeft: theme.spacing(4),
      margin: 0,
    }),
    childItem: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0.5, 0),
    }),
    noResults: css({
      fontStyle: 'italic',
      padding: theme.spacing(0, 1, 1, 1),
    }),
  };
}

