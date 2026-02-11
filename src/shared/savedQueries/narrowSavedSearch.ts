import { type SavedSearch } from './saveSearch';

const isString = (s: unknown) => (typeof s === 'string' && s) || '';

export function narrowSavedSearch(search: unknown): SavedSearch | null {
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

export function narrowSavedSearches(searches: unknown): SavedSearch[] {
  if (!Array.isArray(searches)) {
    return [];
  }
  return searches.map((search) => narrowSavedSearch(search)).filter((search) => search !== null);
}
