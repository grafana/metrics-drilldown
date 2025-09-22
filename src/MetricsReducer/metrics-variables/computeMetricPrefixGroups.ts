import { localeCompare } from 'MetricsReducer/helpers/localCompare';

const NONE_PREFIX = '<none>';

export function computeMetricPrefixGroups(options: Array<{ label: string; value: string }>) {
  const rawPrefixesMap = new Map<string, string[]>();

  for (const option of options) {
    const parts = option.value.split(/[^a-z0-9]/i);
    const key = parts.length <= 1 ? option.value : parts[0];
    const values = rawPrefixesMap.get(key) ?? [];

    values.push(option.value);
    rawPrefixesMap.set(key || NONE_PREFIX, values);
  }

  const prefixesMap = new Map<string, number>();

  for (const [prefix, values] of rawPrefixesMap) {
    prefixesMap.set(prefix, values.length);
  }

  return Array.from(prefixesMap.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }

      return localeCompare(a[0], b[0]);
    })
    .map(([value, count]) => ({
      value,
      count,
      label: value,
    }));
}
