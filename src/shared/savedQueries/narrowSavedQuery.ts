import { type SavedQuery } from './savedQuery';

const isString = (s: unknown) => (typeof s === 'string' && s) || '';

export function narrowSavedQuery(search: unknown): SavedQuery | null {
  if (typeof search !== 'object' || search === null) {
    return null;
  }
  if (
    !('title' in search) ||
    !('description' in search) ||
    !('query' in search) ||
    !('timestamp' in search) ||
    !('dsUid' in search) ||
    !('uid' in search)
  ) {
    return null;
  }
  const timestamp = Number(search.timestamp);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return {
    description: isString(search.description),
    dsUid: isString(search.dsUid),
    query: isString(search.query),
    timestamp,
    title: isString(search.title),
    uid: isString(search.uid),
  };
}

export function narrowSavedQueries(queries: unknown): SavedQuery[] {
  if (!Array.isArray(queries)) {
    return [];
  }
  return queries.map((q) => narrowSavedQuery(q)).filter((q) => q !== null);
}
