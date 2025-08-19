const RATE_QUERY_SUFFIXES = new Set(['count', 'total', 'sum', 'bucket']);

export function isRateQuery(metric: string) {
  const parts = metric.split('_');
  const suffix = parts.at(-1);
  return suffix ? RATE_QUERY_SUFFIXES.has(suffix) : false;
}
