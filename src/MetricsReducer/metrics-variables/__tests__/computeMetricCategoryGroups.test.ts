import { computeMetricCategoryGroups } from '../computeMetricCategoryGroups';
import { METRIC_CATEGORIES, OTHER_CATEGORY_ID } from '../metricCategories';

const createOptions = (values: string[]) => values.map((value) => ({ label: value, value }));

describe('computeMetricCategoryGroups', () => {
  const options = createOptions([
    'go_goroutines',
    'go_gc_duration_seconds',
    'http_requests_total',
    'node_cpu_seconds_total',
  ]);

  test('returns every category in the display order, with "other" last', () => {
    const groups = computeMetricCategoryGroups(options);

    expect(groups.map((group) => group.value)).toEqual([...METRIC_CATEGORIES.map(({ id }) => id), OTHER_CATEGORY_ID]);
  });

  test('counts the metrics of each category', () => {
    const counts = Object.fromEntries(computeMetricCategoryGroups(options).map((group) => [group.value, group.count]));

    expect(counts.runtime).toBe(2);
    expect(counts.http).toBe(1);
    expect(counts[OTHER_CATEGORY_ID]).toBe(1);
  });

  test('keeps the categories that have no metric', () => {
    const groups = computeMetricCategoryGroups(options);
    const kubernetes = groups.find((group) => group.value === 'kubernetes');

    expect(groups).toHaveLength(METRIC_CATEGORIES.length + 1);
    expect(kubernetes?.count).toBe(0);
  });

  test('returns every category with a zero count when there are no metrics', () => {
    const groups = computeMetricCategoryGroups([]);

    expect(groups).toHaveLength(METRIC_CATEGORIES.length + 1);
    expect(groups.every((group) => group.count === 0)).toBe(true);
  });

  test('uses the label of each category', () => {
    const groups = computeMetricCategoryGroups(options);

    expect(groups.find((group) => group.value === 'host-os')?.label).toBe('Host / OS');
    expect(groups.find((group) => group.value === OTHER_CATEGORY_ID)?.label).toBe('Other');
  });
});
