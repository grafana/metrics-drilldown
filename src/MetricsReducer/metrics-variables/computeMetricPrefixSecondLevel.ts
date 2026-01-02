import { localeCompare } from 'MetricsReducer/helpers/localCompare';

/**
 * Regex pattern for separating metric name parts.
 * Matches any non-alphanumeric character (_, -, :, etc.)
 * This should match the pattern used in MetricsVariableFilterEngine.
 */
const METRIC_NAME_SEPARATOR = /[^a-zA-Z0-9]/;

/**
 * Separator used in hierarchical filter values to distinguish levels.
 * Format: "parent:child" (e.g., "grafana:alert")
 */
export const HIERARCHICAL_SEPARATOR = ':';

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

  for (const option of options) {
    const parts = option.value.split(METRIC_NAME_SEPARATOR);

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
