import { localeCompare } from 'MetricsReducer/helpers/localCompare';

const NONE_SUFFIX = '<none>';

export function computeMetricSuffixGroups(options: Array<{ label: string; value: string }>) {
  const rawSuffixesMap = new Map<string, string[]>();

  for (const option of options) {
    const parts = option.value.split(/[^a-z0-9]/i);
    const key = parts.length <= 1 ? option.value : parts[parts.length - 1];
    const values = rawSuffixesMap.get(key) ?? [];

    values.push(option.value);
    rawSuffixesMap.set(key || NONE_SUFFIX, values);
  }

  const suffixesMap = new Map<string, number>();

  for (const [suffix, values] of rawSuffixesMap) {
    suffixesMap.set(suffix, values.length);
  }

  return Array.from(suffixesMap.entries())
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
