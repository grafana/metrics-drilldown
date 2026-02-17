import { ReactNode, useCallback, useState } from 'react';

import semver from 'semver/preload';
import { v4 as uuidv4 } from 'uuid';

import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import pluginJson from '../plugin.json';
import { LabelMatcher } from '../shared/GmdVizPanel/buildQueryExpression';
import { narrowSavedQueries } from './narrowSavedQueries';

const MIN_VERSION = '12.4.0-21256324731';

/**
 * Check if Grafana Query Library is supported in this Grafana version.
 * Requires Grafana 12.4.0+ and the queryLibrary feature flag enabled.
 */
export function isQueryLibrarySupported() {
  return !semver.ltr(config.buildInfo.version, MIN_VERSION) && config.featureToggles.queryLibrary;
}

/**
 * Check if there's already a saved query with the same metric and label matchers.
 * Used to show duplicate warnings.
 */
export function useCheckForExistingQuery(dsUid: string, metric: string, labelMatchers: LabelMatcher[]) {
  const { queries } = useSavedQueries(dsUid);

  return queries.find((query) => {
    if (query.metric !== metric) {
      return false;
    }

    // Check if label matchers match
    if (query.labelMatchers.length !== labelMatchers.length) {
      return false;
    }

    // Compare label matchers (order-independent)
    for (const matcher of labelMatchers) {
      const found = query.labelMatchers.find(
        (qm) => qm.key === matcher.key && qm.operator === matcher.operator && qm.value === matcher.value
      );
      if (!found) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Check if the user has any saved queries for the given datasource.
 * Used to enable/disable the Load Query button.
 */
export function useHasSavedQueries(dsUid: string) {
  const { queries } = useSavedQueries(dsUid);
  return queries.length > 0;
}

/**
 * Main hook for managing saved queries.
 * Provides CRUD operations for saved queries stored in localStorage.
 *
 * @param dsUid - Datasource UID to filter queries by
 * @returns Object with queries array, save, delete functions, and loading state
 */
export function useSavedQueries(dsUid: string) {
  const [queries, setQueries] = useState<SavedQuery[]>(getLocallySavedQueries(dsUid));

  const deleteQuery = useCallback(
    async (uid: string) => {
      removeFromLocalStorage(uid);
      setQueries(getLocallySavedQueries(dsUid));
    },
    [dsUid]
  );

  const saveQuery = useCallback(
    async (query: Omit<SavedQuery, 'timestamp' | 'uid'>) => {
      saveInLocalStorage(query);
      setQueries(getLocallySavedQueries(dsUid));
    },
    [dsUid]
  );

  return {
    isLoading: false,
    saveQuery,
    queries,
    deleteQuery,
  };
}

/**
 * Retrieve saved queries from localStorage, optionally filtered by datasource.
 * Queries are sorted by timestamp (newest first).
 */
function getLocallySavedQueries(dsUid?: string) {
  let stored: SavedQuery[] = [];
  try {
    const item = localStorage.getItem(SAVED_QUERIES_KEY);
    if (item) {
      stored = narrowSavedQueries(JSON.parse(item));
    }
  } catch (e) {
    console.error('Failed to load saved queries from localStorage:', e);
  }
  stored.sort((a, b) => b.timestamp - a.timestamp);
  return stored.filter((query) => (dsUid ? query.dsUid === dsUid : true));
}

export const SAVED_QUERIES_KEY = `${pluginJson.id}.savedQueries`;

/**
 * SavedQuery represents a saved metric exploration state.
 * Can be persisted in localStorage or Grafana Query Library.
 */
export interface SavedQuery {
  uid: string; // Unique identifier
  title: string; // User-provided name
  description: string; // Optional description
  timestamp: number; // Creation timestamp
  dsUid: string; // Datasource UID
  metric: string; // Metric name
  labelMatchers: LabelMatcher[]; // Label filters
  resolution?: 'HIGH' | 'MEDIUM' | 'LOW'; // Optional resolution
  groupByField?: string; // Optional group-by label
}

/**
 * PrometheusQuery is the DataQuery format used by the Query Library.
 * It contains the PromQL expression that we need to parse.
 */
export interface PrometheusQuery extends DataQuery {
  refId: string;
  datasource: { type: 'prometheus'; uid: string };
  expr: string; // PromQL expression
}

/**
 * Save a query to localStorage.
 */
function saveInLocalStorage(query: Omit<SavedQuery, 'timestamp' | 'uid'>) {
  const stored = getLocallySavedQueries();

  stored.push({
    ...query,
    timestamp: new Date().getTime(),
    uid: uuidv4(),
  });

  localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(stored));
}

/**
 * Remove a query from localStorage by UID.
 */
function removeFromLocalStorage(uid: string) {
  const stored = getLocallySavedQueries();
  localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(stored.filter((query) => query.uid !== uid)));
}

/**
 * Props for the Query Library exposed component.
 */
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
