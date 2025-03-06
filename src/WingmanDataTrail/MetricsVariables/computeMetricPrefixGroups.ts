const GROUP_CATCH_ALL = '*';

export function computeMetricPrefixGroups(options: Array<{ label: string; value: string }>) {
  const rawPrefixesMap = new Map();

  for (const option of options) {
    const [sep] = option.value.match(/[^a-z0-9]/i) || [];

    if (!sep) {
      rawPrefixesMap.set(GROUP_CATCH_ALL, (rawPrefixesMap.get(GROUP_CATCH_ALL) ?? 0) + 1);
    } else {
      const [prefix] = option.value.split(sep);
      rawPrefixesMap.set(prefix, (rawPrefixesMap.get(prefix) ?? 0) + 1);
    }
  }

  const prefixesMap = new Map([[GROUP_CATCH_ALL, 0]]);

  for (const [prefix, count] of rawPrefixesMap) {
    if (count === 1) {
      prefixesMap.set(GROUP_CATCH_ALL, (prefixesMap.get(GROUP_CATCH_ALL) ?? 0) + 1);
    } else {
      prefixesMap.set(prefix, count);
    }
  }

  return Array.from(prefixesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({
      value,
      count,
      label: value,
    }));
}
