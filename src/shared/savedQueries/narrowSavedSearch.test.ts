import { narrowSavedSearch, narrowSavedSearches } from './narrowSavedSearch';

describe('narrowSavedSearch', () => {
  test('returns a valid SavedSearch from a valid object', () => {
    const result = narrowSavedSearch({
      title: 'Test',
      description: 'A test search',
      query: 'up{job="test"}',
      timestamp: 1234567890,
      dsUid: 'ds-1',
      uid: 'uid-1',
    });

    expect(result).toEqual({
      title: 'Test',
      description: 'A test search',
      query: 'up{job="test"}',
      timestamp: 1234567890,
      dsUid: 'ds-1',
      uid: 'uid-1',
    });
  });

  test('returns null for null input', () => {
    expect(narrowSavedSearch(null)).toBeNull();
  });

  test('returns null for non-object input', () => {
    expect(narrowSavedSearch('string')).toBeNull();
    expect(narrowSavedSearch(123)).toBeNull();
    expect(narrowSavedSearch(undefined)).toBeNull();
  });

  test('returns null when required fields are missing', () => {
    expect(narrowSavedSearch({ title: 'Test' })).toBeNull();
    expect(narrowSavedSearch({ title: 'Test', description: 'desc' })).toBeNull();
  });

  test('coerces non-string fields to empty strings', () => {
    const result = narrowSavedSearch({
      title: 123,
      description: null,
      query: undefined,
      timestamp: 'not-a-number',
      dsUid: true,
      uid: {},
    });

    expect(result).toEqual({
      title: '',
      description: '',
      query: '',
      timestamp: NaN,
      dsUid: '',
      uid: '',
    });
  });
});

describe('narrowSavedSearches', () => {
  test('returns an array of valid SavedSearches', () => {
    const result = narrowSavedSearches([
      {
        title: 'Test 1',
        description: 'First',
        query: 'up',
        timestamp: 1000,
        dsUid: 'ds-1',
        uid: 'uid-1',
      },
      {
        title: 'Test 2',
        description: 'Second',
        query: 'down',
        timestamp: 2000,
        dsUid: 'ds-2',
        uid: 'uid-2',
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Test 1');
    expect(result[1].title).toBe('Test 2');
  });

  test('filters out invalid entries', () => {
    const result = narrowSavedSearches([
      {
        title: 'Valid',
        description: 'Valid',
        query: 'up',
        timestamp: 1000,
        dsUid: 'ds-1',
        uid: 'uid-1',
      },
      null,
      'invalid',
      { title: 'Incomplete' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Valid');
  });

  test('returns empty array for non-array input', () => {
    expect(narrowSavedSearches('not-an-array')).toEqual([]);
    expect(narrowSavedSearches(null)).toEqual([]);
    expect(narrowSavedSearches(undefined)).toEqual([]);
  });

  test('returns empty array for empty array', () => {
    expect(narrowSavedSearches([])).toEqual([]);
  });
});
