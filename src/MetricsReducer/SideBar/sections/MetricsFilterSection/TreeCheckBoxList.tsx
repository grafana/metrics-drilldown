import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import React from 'react';

import { getSharedListStyles } from 'MetricsReducer/SideBar/sections/sharedListStyles';

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
  const sharedStyles = useStyles2(getSharedListStyles);
  const treeStyles = useStyles2(getTreeStyles);

  // Helper: Check if parent is directly selected (not children)
  const isParentChecked = (parentValue: string) => {
    return selectedGroups.some((g) => g.value === parentValue);
  };

  // Helper: Check if parent has selected children (indeterminate state)
  const hasSelectedChildren = (parentValue: string) => {
    return selectedGroups.some((g) => g.value.startsWith(parentValue + ':'));
  };

  // Helper: Get children for a parent
  const getChildren = (parentValue: string) => {
    return computedSublevels.get(parentValue) || [];
  };

  // Handle parent checkbox click
  const handleParentChange = (parent: { label: string; value: string }, checked: boolean, isIndeterminate: boolean) => {
    if (checked || isIndeterminate) {
      // Clicking checked → uncheck, OR clicking indeterminate → check parent (remove children)
      // Add parent, remove any children
      const newGroups = [
        ...selectedGroups.filter((g) => !g.value.startsWith(parent.value + ':')),
        { label: parent.label as RuleGroupLabel, value: parent.value },
      ];
      onSelectionChange(newGroups);
    } else {
      // Unchecking parent → remove it
      const newGroups = selectedGroups.filter((g) => g.value !== parent.value);
      onSelectionChange(newGroups);
    }
  };

  // Handle child checkbox click
  const handleChildChange = (child: { label: string; value: string }, checked: boolean) => {
    const [parentPrefix, sublevel] = child.value.split(':');

    if (checked) {
      // Add child with full hierarchy label for display in top chip
      const hierarchicalLabel = `${parentPrefix} > ${sublevel}`;
      const newGroups = [
        ...selectedGroups.filter((g) => g.value !== parentPrefix),
        { label: hierarchicalLabel as RuleGroupLabel, value: child.value },
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
      <div className={sharedStyles.listHeader}>
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

      {!groups.length && <div className={sharedStyles.noResults}>No results.</div>}

      {groups.length > 0 && (
        <ul className={sharedStyles.list} data-testid="checkbox-filters-tree">
          {groups.map((group) => {
            const isExpanded = expandedPrefixes.has(group.value);
            const children = getChildren(group.value);
            const hasChildren = children.length > 0 || isExpanded;
            const isChecked = isParentChecked(group.value);
            const isIndeterminate = !isChecked && hasSelectedChildren(group.value);

            return (
              <React.Fragment key={group.value}>
                {/* Parent Row */}
                <li className={cx(sharedStyles.listItem, isExpanded && treeStyles.stickyParent)}>
                  <div className={treeStyles.parentRow}>
                    {/* Expand/Collapse Icon */}
                    <button
                      className={treeStyles.expandButton}
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
                      indeterminate={isIndeterminate}
                      onChange={(e) => handleParentChange(group, e.currentTarget.checked, isIndeterminate)}
                    />
                  </div>
                </li>

                {/* Children Rows (if expanded) */}
                {isExpanded && hasChildren && (
                  <ul className={treeStyles.childrenList}>
                    {children.map((child) => (
                      <li key={child.value} className={treeStyles.childItem}>
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

/**
 * Tree-specific styles for hierarchical checkbox list.
 * Base list styles (header, list, items) are imported from sharedListStyles.
 */
function getTreeStyles(theme: GrafanaTheme2) {
  return {
    stickyParent: css({
      position: 'sticky',
      top: 0,
      // Force fully opaque background using pseudo-element
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.background.canvas,
        zIndex: -1,
      },
      backgroundColor: theme.colors.background.canvas,
      zIndex: 10,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      marginLeft: theme.spacing(-1),
      marginRight: theme.spacing(-1),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
      // Shadow to emphasize stickiness
      boxShadow: `0 2px 4px rgba(0, 0, 0, 0.1)`,
    }),
    parentRow: css({
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      position: 'relative',
      zIndex: 1,
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
  };
}

