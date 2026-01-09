import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import React from 'react';

import { HIERARCHICAL_SEPARATOR } from 'MetricsReducer/metrics-variables/computeMetricPrefixSecondLevel';
import { getSharedListStyles } from 'MetricsReducer/SideBar/sections/sharedListStyles';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { CheckboxWithCount } from './CheckboxWithCount';
import { type MetricsFilterSectionState } from './MetricsFilterSection';
import { type RuleGroupLabel } from './rule-group-labels';

type TreeCheckBoxListProps = {
  groups: MetricsFilterSectionState['groups'];
  selectedGroups: MetricsFilterSectionState['selectedGroups'];
  expandedPrefixes: Set<string>;
  computedSublevels: Map<string, Array<{ label: string; value: string; count: number }>>;
  onSelectionChange: (newGroups: MetricsFilterSectionState['selectedGroups']) => void;
  onExpandToggle: (prefix: string) => void;
};

/**
 * TreeCheckBoxList - Hierarchical checkbox list for two-level prefix filtering.
 *
 * Displays parent prefixes (Level 0) with expandable children (Level 1).
 * Supports:
 * - Parent checkbox shows as checked when parent OR any children are selected
 * - Lazy computation of sublevels (only when expanded)
 * - Sticky parent rows during scrolling for context
 * - Clear parent/child selection logic
 *
 * Selection behavior:
 * - Checking parent: Adds parent, removes any children (select all with prefix)
 * - Unchecking parent: Removes parent AND all children (clears entire branch)
 * - Checking child: Adds child, removes parent if selected (refine to specific subset)
 * - Unchecking last child: Selects parent (navigate up tree from specific to general)
 * - Unchecking child with siblings: Removes child only (keeps other children)
 */
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

  // Helper: Check if parent or any of its children are selected
  const isParentChecked = (parentValue: string) => {
    return selectedGroups.some(
      (g) => g.value === parentValue || g.value.startsWith(parentValue + HIERARCHICAL_SEPARATOR)
    );
  };

  // Helper: Get children for a parent
  const getChildren = (parentValue: string) => {
    return computedSublevels.get(parentValue) || [];
  };

  // Add parent to selection and remove any children
  const selectParent = (parent: { label: string; value: string }) => {
    const newGroups = [
      ...selectedGroups.filter((g) => !g.value.startsWith(parent.value + HIERARCHICAL_SEPARATOR)),
      { label: parent.label as RuleGroupLabel, value: parent.value },
    ];
    onSelectionChange(newGroups);
  };

  // Remove parent AND all children from selection (clear entire branch)
  const unselectParent = (parentValue: string) => {
    const newGroups = selectedGroups.filter(
      (g) => g.value !== parentValue && !g.value.startsWith(parentValue + HIERARCHICAL_SEPARATOR)
    );
    onSelectionChange(newGroups);
  };

  // Handle child checkbox click
  const handleChildChange = (child: { label: string; value: string }, checked: boolean) => {
    const [parentPrefix, sublevel] = child.value.split(HIERARCHICAL_SEPARATOR);

    if (checked) {
      // Add child with full hierarchy label for display in top chip
      const hierarchicalLabel = `${parentPrefix} > ${sublevel}`;
      const newGroups = [
        ...selectedGroups.filter((g) => g.value !== parentPrefix),
        { label: hierarchicalLabel as RuleGroupLabel, value: child.value },
      ];
      onSelectionChange(newGroups);

      // Track hierarchical child filter selection
      reportExploreMetrics('sidebar_hierarchical_child_filter_applied', {
        prefix: parentPrefix,
        child: sublevel,
      });
    } else {
      // Unchecking a child
      // Check if this is the last remaining child from this parent
      const siblingsFromSameParent = selectedGroups.filter(
        (g) => g.value.startsWith(parentPrefix + HIERARCHICAL_SEPARATOR) && g.value !== child.value
      );

      if (siblingsFromSameParent.length === 0) {
        // This is the last child - navigate up the tree by selecting the parent
        // Look up the actual parent from groups to get its proper label
        const parentGroup = groups.find((g) => g.value === parentPrefix);
        if (parentGroup) {
          // Remove ALL children from this parent, not just the one being unchecked
          const newGroups = [
            ...selectedGroups.filter((g) => !g.value.startsWith(parentPrefix + HIERARCHICAL_SEPARATOR)),
            { label: parentGroup.label as RuleGroupLabel, value: parentGroup.value },
          ];
          onSelectionChange(newGroups);
        } else {
          // Fallback: just remove the child if we can't find the parent
          const newGroups = selectedGroups.filter((g) => g.value !== child.value);
          onSelectionChange(newGroups);
        }
      } else {
        // Other children still selected - just remove this child
        const newGroups = selectedGroups.filter((g) => g.value !== child.value);
        onSelectionChange(newGroups);
      }
    }
  };

  return (
    <>
      <div className={sharedStyles.listHeader}>
        <div>{selectedGroups.length} selected</div>
        <Button variant="secondary" fill="text" onClick={() => onSelectionChange([])} disabled={!selectedGroups.length}>
          clear
        </Button>
      </div>

      {!groups.length && <div className={sharedStyles.noResults}>No results.</div>}

      {groups.length > 0 && (
        <ul className={sharedStyles.list} data-testid="checkbox-filters-tree">
          {groups.map((group) => {
            const isExpanded = expandedPrefixes.has(group.value);
            const children = getChildren(group.value);
            const isChecked = isParentChecked(group.value);

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
                      onChange={(e) => (e.currentTarget.checked ? selectParent(group) : unselectParent(group.value))}
                    />
                  </div>
                </li>

                {/* Children Rows (if expanded) */}
                {isExpanded && children.length > 0 && (
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
