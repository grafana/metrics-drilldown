import { CATEGORY_MATCHERS } from './categoryMatchers';

export function computeMetricCategories(options: Array<{ label: string; value: string }>) {
  const categoriesMap = new Map();

  for (const option of options) {
    const categories = inferCategoriesFromMetric(option.value);

    for (const category of categories) {
      categoriesMap.set(category, (categoriesMap.get(category) ?? 0) + 1);
    }
  }

  return Array.from(categoriesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({
      value,
      label: CATEGORY_MATCHERS.get(value)?.label ?? value,
      count,
    }));
}

function inferCategoriesFromMetric(metric: string): string[] {
  const categories = [];

  for (const [category, matcher] of CATEGORY_MATCHERS) {
    if (matcher.match(metric)) {
      categories.push(category);
    }
  }

  return categories;
}
