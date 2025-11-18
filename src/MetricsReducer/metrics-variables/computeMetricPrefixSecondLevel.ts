import { localeCompare } from 'MetricsReducer/helpers/localCompare';

/**
 * Compute second-level prefix groups (lazy computation for tree filtering)
 * @param options All metric options
 * @param parentPrefix The parent prefix to compute children for (e.g., "grafana")
 * @returns Array of second-level groups with counts
 */
export function computeMetricPrefixSecondLevel(
  options: Array<{ label: string; value: string }>,
  parentPrefix: string
): Array<{ label: string; value: string; count: number }> {
  const sublevelMap = new Map<string, number>();
  const separator = /[^a-z0-9]/i;

  for (const option of options) {
    const parts = option.value.split(separator);
    
    // Only process metrics matching the parent prefix and having a second level
    if (parts[0] === parentPrefix && parts.length > 1) {
      const sublevel = parts[1];
      sublevelMap.set(sublevel, (sublevelMap.get(sublevel) || 0) + 1);
    }
  }

  return Array.from(sublevelMap.entries())
    .sort((a, b) => {
      // Sort by count descending, then alphabetically
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return localeCompare(a[0], b[0]);
    })
    .map(([sublevel, count]) => ({
      value: `${parentPrefix}:${sublevel}`,
      count,
      label: sublevel, // Just the sublevel for display in tree
    }));
}

