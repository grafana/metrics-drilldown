import { config } from '@grafana/runtime';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';


import { narrowSavedQueries } from './narrowSavedQuery';
import {
  isQueryLibrarySupported,
  SAVED_QUERIES_KEY,
  useCheckForExistingQuery,
  useHasSavedQueries,
  useSavedQueries,
  type SavedQuery,
} from './savedQuery';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    buildInfo: {
      version: '12.4.0',
    },
    featureToggles: {
      queryLibrary: true,
    },
  },
}));
jest.unmock('semver/preload');

const localQueries = [
  {
    dsUid: 'ds-local-1',
    title: 'Local Query 1',
    query: 'http_requests_total{method="GET"}',
    description: 'First local query',
    timestamp: new Date('2026-01-10T00:00:00Z').getTime(),
    uid: 'local-uid-1',
  },
  {
    dsUid: 'ds-local-1',
    title: 'Local Query 2',
    query: 'http_requests_total{method="POST"}',
    description: 'Second local query',
    timestamp: new Date('2026-01-15T00:00:00Z').getTime(),
    uid: 'local-uid-2',
  },
  {
    dsUid: 'ds-local-2',
    title: 'Local Query 3',
    query: 'up{job="prometheus"}',
    description: 'Third local query',
    timestamp: new Date('2026-01-12T00:00:00Z').getTime(),
    uid: 'local-uid-3',
  },
];

beforeEach(() => {
  localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(localQueries));
});

describe('useSavedQueries', () => {
  beforeEach(() => {
    localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(localQueries));
  });

  test('Should load queries from localStorage', () => {
    const { result } = renderHook(() => useSavedQueries('ds-local-1'));

    expect(result.current.queries).toHaveLength(2);
    expect(result.current.queries.every((q) => q.dsUid === 'ds-local-1')).toBe(true);
  });

  test('Should save query to localStorage', async () => {
    const { result } = renderHook(() => useSavedQueries('ds-local-1'));

    const newQuery = {
      dsUid: 'ds-local-1',
      title: 'New Local Query',
      query: 'node_cpu_seconds_total{mode="idle"}',
      description: 'A new local query',
    };

    await act(async () => {
      await result.current.saveQuery(newQuery);
    });

    const stored = narrowSavedQueries(JSON.parse(localStorage.getItem(SAVED_QUERIES_KEY) || '[]'));
    expect(stored).toHaveLength(4);
    expect(stored.some((q: SavedQuery) => q.title === 'New Local Query')).toBe(true);
  });

  test('Should delete query from localStorage', async () => {
    const { result, rerender } = renderHook(() => useSavedQueries('ds-local-1'));

    expect(result.current.queries).toHaveLength(2);

    await act(async () => {
      await result.current.deleteQuery('local-uid-1');
    });
    rerender();

    await waitFor(() => {
      expect(result.current.queries).toHaveLength(1);
      expect(result.current.queries[0].uid).toBe('local-uid-2');
    });
  });

  test('should sort queries by timestamp descending', () => {
    const { result } = renderHook(() => useSavedQueries('ds-local-1'));

    expect(result.current.queries[0].title).toBe('Local Query 2'); // 2026-01-15
    expect(result.current.queries[1].title).toBe('Local Query 1'); // 2026-01-10
  });

  test('Should handle empty localStorage gracefully', () => {
    localStorage.clear();
    const { result } = renderHook(() => useSavedQueries('ds-local-1'));

    expect(result.current.queries).toHaveLength(0);
  });
});

describe('useCheckForExistingQuery', () => {
  test('Checks for existing queries', () => {
    const { result } = renderHook(() => useCheckForExistingQuery('ds-local-1', localQueries[0].query));
    expect(result.current).toBeDefined();
  });

  test('Checks for non-existing queries', () => {
    const { result } = renderHook(() => useCheckForExistingQuery('ds-local-1', 'nonexistent_metric'));
    expect(result.current).toBeUndefined();
  });
});

describe('useHasSavedQueries', () => {
  test('Checks for existing queries', () => {
    const { result } = renderHook(() => useHasSavedQueries('ds-local-1'));
    expect(result.current).toBe(true);
  });

  test('Checks for empty queries', () => {
    const { result } = renderHook(() => useHasSavedQueries('ds-local-nope'));
    expect(result.current).toBe(false);
  });
});

describe('isQueryLibrarySupported', () => {
  test('Returns true when supported', () => {
    expect(isQueryLibrarySupported()).toBe(true);
  });

  test('Returns false if the feature is not enabled', () => {
    config.featureToggles.queryLibrary = false;
    expect(isQueryLibrarySupported()).toBe(false);
  });

  test('Returns false if the Grafana version is not supported', () => {
    config.featureToggles.queryLibrary = true;
    config.buildInfo.version = '12.3.0';
    expect(isQueryLibrarySupported()).toBe(false);
  });
});
