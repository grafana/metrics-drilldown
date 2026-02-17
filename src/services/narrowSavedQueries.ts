import { SavedQuery } from './saveQuery';

const isString = (s: unknown) => (typeof s === 'string' && s) || '';

export function isSavedQuery(obj: unknown): obj is SavedQuery {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return (
    'title' in obj &&
    'description' in obj &&
    'metric' in obj &&
    'labelMatchers' in obj &&
    'timestamp' in obj &&
    'dsUid' in obj &&
    'uid' in obj
  );
}

export function narrowSavedQuery(query: unknown): SavedQuery | null {
  if (!isSavedQuery(query)) {
    return null;
  }

  return {
    description: isString(query.description),
    dsUid: isString(query.dsUid),
    metric: isString(query.metric),
    labelMatchers: Array.isArray(query.labelMatchers) ? query.labelMatchers : [],
    timestamp: Number(query.timestamp),
    title: isString(query.title),
    uid: isString(query.uid),
    resolution: query.resolution,
    groupByField: query.groupByField ? isString(query.groupByField) : undefined,
  };
}

export function narrowSavedQueries(queries: unknown): SavedQuery[] {
  if (!Array.isArray(queries)) {
    return [];
  }
  return queries.map((query) => narrowSavedQuery(query)).filter((query) => query !== null);
}
