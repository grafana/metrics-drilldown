const GROUP_CATCH_ALL = '*';

export function computeMetricSuffixGroups(options: Array<{ label: string; value: string }>) {
  const rawSuffixesMap = new Map<string, string[]>();

  for (const option of options) {
    const parts = option.value.split(/[^a-z0-9]/i);
    const key = parts.length <= 1 ? GROUP_CATCH_ALL : parts[parts.length - 1];
    const values = rawSuffixesMap.get(key) ?? [];

    values.push(option.value);
    rawSuffixesMap.set(key, values);
  }

  const catchAllValues = rawSuffixesMap.get(GROUP_CATCH_ALL) ?? [];
  const suffixesMap = new Map([[GROUP_CATCH_ALL, catchAllValues.length]]);

  for (const [suffix, values] of rawSuffixesMap) {
    if (values.length === 1) {
      suffixesMap.set(GROUP_CATCH_ALL, suffixesMap.get(GROUP_CATCH_ALL)! + 1);
      catchAllValues.push(values[0]);
    } else {
      suffixesMap.set(suffix, values.length);
    }
  }

  return Array.from(suffixesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => {
      if (value === GROUP_CATCH_ALL) {
        return {
          value: catchAllValues.join('|'), // see FilteredMetricsVariable
          count,
          label: '<none>',
        };
      }

      return {
        value,
        count,
        label: value,
      };
    });
}
