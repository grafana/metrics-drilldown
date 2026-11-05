import { classifyMetric, getMetricCategoryLabel, METRIC_CATEGORIES, OTHER_CATEGORY_ID } from './metricCategories';

/**
 * Counts the metrics of each category, in the display order of the categories, with "other" last.
 * Every category is returned, even when it has no metric, so that the sidebar can refresh the counts later
 * (see MetricsFilterSection.updateCounts) and hide the empty categories with its "Hide empty" switch.
 */
export function computeMetricCategoryGroups(options: Array<{ label: string; value: string }>) {
  const counts = new Map<string, number>();

  for (const option of options) {
    const id = classifyMetric(option.value);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return [...METRIC_CATEGORIES.map(({ id }) => id), OTHER_CATEGORY_ID].map((id) => ({
    value: id,
    label: getMetricCategoryLabel(id),
    count: counts.get(id) ?? 0,
  }));
}
