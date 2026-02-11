import { type SavedQuery } from './savedQuery';

const isString = (s: unknown) => (typeof s === 'string' && s) || '';

export function narrowSavedQuery(search: unknown): SavedQuery | null {
  if (typeof search !== 'object' || search === null) {
    return null;
  }
  return 'title' in search &&
    'description' in search &&
    'query' in search &&
    'timestamp' in search &&
    'dsUid' in search &&
    'uid' in search
    ? {
        description: isString(search.description),
        dsUid: isString(search.dsUid),
        query: isString(search.query),
        timestamp: Number(search.timestamp),
        title: isString(search.title),
        uid: isString(search.uid),
      }
    : null;
}

export function narrowSavedQueries(queries: unknown): SavedQuery[] {
  if (!Array.isArray(queries)) {
    return [];
  }
  return queries.map((q) => narrowSavedQuery(q)).filter((q) => q !== null);
}
