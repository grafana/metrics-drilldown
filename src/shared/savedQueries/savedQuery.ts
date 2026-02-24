import { config } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import semver from 'semver/preload';
import { v4 as uuidv4 } from 'uuid';


import { narrowSavedQueries } from './narrowSavedQuery';
import pluginJson from '../../plugin.json';
import { logger } from '../logger/logger';

const MIN_VERSION = '12.4.0-21256324731';

const savedQueryListeners = new Set<() => void>();

function notifySavedQueryChanges() {
  for (const fn of savedQueryListeners) {
    fn();
  }
}

export function isQueryLibrarySupported() {
  return !semver.ltr(config.buildInfo.version, MIN_VERSION) && config.featureToggles.queryLibrary;
}

export function findExistingQuery(queries: SavedQuery[], query: string) {
  return queries.find((q) => q.query === query);
}

export function useHasSavedQueries(dsUid: string) {
  const { queries } = useSavedQueries(dsUid);
  return queries.length > 0;
}

export function useSavedQueries(dsUid: string) {
  const [queries, setQueries] = useState<SavedQuery[]>(getLocallySavedQueries(dsUid));

  useEffect(() => {
    const refresh = () => setQueries(getLocallySavedQueries(dsUid));
    refresh(); // immediately sync state when dsUid changes
    savedQueryListeners.add(refresh);
    return () => {
      savedQueryListeners.delete(refresh);
    };
  }, [dsUid]);

  const deleteQuery = useCallback(
    async (uid: string) => {
      removeFromLocalStorage(uid);
      notifySavedQueryChanges();
    },
    []
  );

  const saveQuery = useCallback(
    async (query: Omit<SavedQuery, 'timestamp' | 'uid'>) => {
      saveInLocalStorage(query);
      notifySavedQueryChanges();
    },
    []
  );

  return {
    isLoading: false,
    saveQuery,
    queries,
    deleteQuery,
  };
}

function getLocallySavedQueries(dsUid?: string) {
  let stored: SavedQuery[] = [];
  try {
    stored = narrowSavedQueries(JSON.parse(localStorage.getItem(SAVED_QUERIES_KEY) ?? '[]'));
  } catch (e) {
    logger.error(e instanceof Error ? e : new Error(String(e)));
  }
  stored.sort((a, b) => b.timestamp - a.timestamp);
  return stored.filter((q) => (dsUid !== undefined ? q.dsUid === dsUid : true));
}

export const SAVED_QUERIES_KEY = `${pluginJson.id}.savedQueries`;

export interface SavedQuery {
  description: string;
  dsUid: string;
  query: string;
  timestamp: number;
  title: string;
  uid: string;
}

function saveInLocalStorage({ query, title, description, dsUid }: Omit<SavedQuery, 'timestamp' | 'uid'>) {
  const stored = getLocallySavedQueries();

  stored.push({
    dsUid,
    description,
    query,
    timestamp: new Date().getTime(),
    title,
    uid: uuidv4(),
  });

  localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(stored));
}

function removeFromLocalStorage(uid: string) {
  const stored = getLocallySavedQueries();
  localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(stored.filter((q) => q.uid !== uid)));
}

export interface OpenQueryLibraryComponentProps {
  className?: string;
  context?: string;
  datasourceFilters?: string[];
  fallbackComponent?: ReactNode;
  icon?: string;
  onSelectQuery?(query: DataQuery): void;
  query?: DataQuery;
  tooltip?: string;
}
