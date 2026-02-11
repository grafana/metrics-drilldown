import { narrowSavedQueries, narrowSavedQuery } from './narrowSavedQuery';

describe('narrowSavedQuery', () => {
  test('returns a valid SavedQuery from a valid object', () => {
    const result = narrowSavedQuery({
      title: 'Test',
      description: 'A test query',
      query: 'up{job="test"}',
      timestamp: 1234567890,
      dsUid: 'ds-1',
      uid: 'uid-1',
    });

    expect(result).toEqual({
      title: 'Test',
      description: 'A test query',
      query: 'up{job="test"}',
      timestamp: 1234567890,
      dsUid: 'ds-1',
      uid: 'uid-1',
    });
  });

  test('returns null for null input', () => {
    expect(narrowSavedQuery(null)).toBeNull();
  });

  test('returns null for non-object input', () => {
    expect(narrowSavedQuery('string')).toBeNull();
    expect(narrowSavedQuery(123)).toBeNull();
    expect(narrowSavedQuery(undefined)).toBeNull();
  });

  test('returns null when required fields are missing', () => {
    expect(narrowSavedQuery({ title: 'Test' })).toBeNull();
    expect(narrowSavedQuery({ title: 'Test', description: 'desc' })).toBeNull();
  });

  test('coerces non-string fields to empty strings', () => {
    const result = narrowSavedQuery({
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

describe('narrowSavedQueries', () => {
  test('returns an array of valid SavedQueries', () => {
    const result = narrowSavedQueries([
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
    const result = narrowSavedQueries([
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
    expect(narrowSavedQueries('not-an-array')).toEqual([]);
    expect(narrowSavedQueries(null)).toEqual([]);
    expect(narrowSavedQueries(undefined)).toEqual([]);
  });

  test('returns empty array for empty array', () => {
    expect(narrowSavedQueries([])).toEqual([]);
  });
});
