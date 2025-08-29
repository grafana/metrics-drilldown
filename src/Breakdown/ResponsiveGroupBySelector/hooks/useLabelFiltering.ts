import { useMemo } from 'react';

import type { AdHocVariableFilter } from '@grafana/data';

/**
 * Hook for filtering labels based on current application state
 * @param allLabels - All available labels from the variable
 * @param currentFilters - Current ad-hoc filters applied
 * @param selectedLabel - Currently selected label for grouping
 * @returns Filtered array of labels excluding already filtered and selected labels
 */
export function useLabelFiltering(
  allLabels: string[],
  currentFilters: AdHocVariableFilter[],
  selectedLabel: string | null
) {
  return useMemo(() => {
    return allLabels.filter(label => {
      // Remove already filtered labels (with = or != operators) and currently selected label
      return !(currentFilters.some(f => f.key === label && (f.operator === '=' || f.operator === '!=')) ||
               label === selectedLabel);
    });
  }, [allLabels, currentFilters, selectedLabel]);
}
