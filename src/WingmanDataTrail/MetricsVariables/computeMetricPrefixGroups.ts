const GROUP_CATCH_ALL = '*';

export function computeMetricPrefixGroups(options: Array<{ label: string; value: string }>) {
  const rawPrefixesMap = new Map<string, string[]>();

  for (const option of options) {
    const [sep] = option.value.match(/[^a-z0-9]/i) || [];
    const key = !sep ? GROUP_CATCH_ALL : option.value.split(sep)[0];
    const values = rawPrefixesMap.get(key) ?? [];

    values.push(option.value);
    rawPrefixesMap.set(key, values);
  }

  const catchAllValues = rawPrefixesMap.get(GROUP_CATCH_ALL) ?? [];
  const prefixesMap = new Map([[GROUP_CATCH_ALL, catchAllValues.length]]);

  for (const [prefix, values] of rawPrefixesMap) {
    if (values.length === 1) {
      prefixesMap.set(GROUP_CATCH_ALL, prefixesMap.get(GROUP_CATCH_ALL)! + 1);
      catchAllValues.push(values[0]);
    } else {
      prefixesMap.set(prefix, values.length);
    }
  }

  return Array.from(prefixesMap.entries())
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
