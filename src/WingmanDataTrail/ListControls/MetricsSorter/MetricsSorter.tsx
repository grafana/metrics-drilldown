import {
  CustomVariable,
  sceneGraph,
  SceneObjectBase,
  SceneVariableSet,
  VariableValueSelectors,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type VariableValueOption,
} from '@grafana/scenes';
import React from 'react';

import { localeCompare } from 'WingmanDataTrail/helpers/localCompare';

import { EventSortByChanged } from './events/EventSortByChanged';
import { type MetricUsageDetails } from './fetchers/fetchDashboardMetrics';
import { MetricUsageFetcher, type MetricUsageType } from './MetricUsageFetcher';
import { logger } from '../../../tracking/logger/logger';
import { PREF_KEYS } from '../../../UserPreferences/pref-keys';
import { userPreferences } from '../../../UserPreferences/userPreferences';
export type SortingOption = 'default' | 'dashboard-usage' | 'alerting-usage';

const MAX_RECENT_METRICS = 6;
const RECENT_METRICS_EXPIRY_DAYS = 30;

interface RecentMetric {
  name: string;
  timestamp: number;
}

/**
 * Adds a metric to the recent metrics list in localStorage
 * @param metricName The name of the metric to add
 */
export function addRecentMetric(metricName: string): void {
  try {
    const recentMetrics = getRecentMetrics();
    const now = Date.now();

    // Remove the metric if it already exists and add it with new timestamp
    const filteredMetrics = recentMetrics.filter((m) => m.name !== metricName);
    filteredMetrics.unshift({ name: metricName, timestamp: now });

    // Keep only the most recent metrics
    const updatedMetrics = filteredMetrics.slice(0, MAX_RECENT_METRICS);
    userPreferences.setItem(PREF_KEYS.RECENT_METRICS, updatedMetrics);
  } catch (error) {
    const errorObject = error instanceof Error ? error : new Error(String(error));

    logger.error(errorObject, {
      ...(errorObject.cause || {}),
      metricName,
    });
  }
}

/**
 * Gets the list of recent metrics from localStorage, removing expired ones
 * @returns Array of recent metric names
 */
export function getRecentMetrics(): RecentMetric[] {
  try {
    const recentMetrics: RecentMetric[] = userPreferences.getItem(PREF_KEYS.RECENT_METRICS) || [];
    if (!recentMetrics.length) {
      return [];
    }

    const now = Date.now();
    const thirtyDaysAgo = now - RECENT_METRICS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    // Filter out expired metrics
    const validMetrics = recentMetrics.filter((metric) => metric.timestamp > thirtyDaysAgo);

    // If any metrics were removed, update storage
    if (validMetrics.length !== recentMetrics.length) {
      userPreferences.setItem(PREF_KEYS.RECENT_METRICS, validMetrics);
    }

    return validMetrics;
  } catch (error) {
    logger.error(error as Error, { message: 'Failed to get recent metrics:' });
    return [];
  }
}

interface MetricsSorterState extends SceneObjectState {
  $variables: SceneVariableSet;
  inputControls: SceneObject;
}

export const sortByOptions: VariableValueOption[] = [
  { label: 'Default', value: 'default' },
  { label: 'Dashboard Usage', value: 'dashboard-usage' },
  { label: 'Alerting Usage', value: 'alerting-usage' },
];

export const VAR_WINGMAN_SORT_BY = 'metrics-reducer-sort-by';

export class MetricsSorter extends SceneObjectBase<MetricsSorterState> {
  initialized = false;
  supportedSortByOptions = new Set<SortingOption>(['default', 'dashboard-usage', 'alerting-usage']);
  private usageFetcher = new MetricUsageFetcher();

  constructor(state: Partial<MetricsSorterState>) {
    super({
      ...state,
      key: 'metrics-sorter',
      $variables: new SceneVariableSet({
        variables: [
          new CustomVariable({
            name: VAR_WINGMAN_SORT_BY,
            label: 'Sort by',
            value: 'default',
            query: sortByOptions.map((option) => `${option.label} : ${option.value}`).join(','),
            description:
              'Sort metrics by default (alphabetically, with recently-selected metrics first), by prevalence in dashboard panel queries, or by prevalence in alerting rules',
          }),
        ],
      }),
      inputControls: new VariableValueSelectors({ layout: 'horizontal' }),
    });

    this.addActivationHandler(() => this.activationHandler());
  }

  private activationHandler() {
    const sortByVar = sceneGraph.getVariables(this).getByName(VAR_WINGMAN_SORT_BY) as CustomVariable;

    if (!this.supportedSortByOptions.has(sortByVar.getValue() as SortingOption)) {
      // Migration for the old sortBy values
      sortByVar.changeValueTo('default');
    }

    this._subs.add(
      sortByVar.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.publishEvent(new EventSortByChanged({ sortBy: newState.value as SortingOption }), true);
        }
      })
    );
  }

  public getUsageDetailsForMetric(metricName: string, usageType: MetricUsageType): Promise<MetricUsageDetails> {
    return this.usageFetcher.getUsageDetailsForMetric(metricName, usageType);
  }

  // Converts MetricUsageDetails format to simple counts (Record<string, number>) for backward compatibility with sorting logic
  public getUsageMetrics(usageType: MetricUsageType): Promise<Record<string, number>> {
    return this.usageFetcher.getUsageMetrics(usageType).then((metrics) => {
      const metricsToCounts: Record<string, number> = {};
      for (const metric in metrics) {
        metricsToCounts[metric] = metrics[metric].count;
      }
      return metricsToCounts;
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<MetricsSorter>) => {
    const { inputControls } = model.useState();

    return (
      <div data-testid="sort-by-select">
        <inputControls.Component model={inputControls} />
      </div>
    );
  };
}

/**
 * Sort metrics by an arbitrary count (descending)
 * @param metrics Array of metric names
 * @param counts A record mapping metric names to an arbitrary count
 * @returns Sorted array of metric names
 */
export function sortMetricsByCount(metrics: string[], counts: Record<string, number>): string[] {
  return [...metrics].sort((a, b) => {
    const scoreA = counts[a] || 0;
    const scoreB = counts[b] || 0;

    // Primary sort by score (descending)
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // Secondary sort alphabetically for metrics with the same score
    return localeCompare(a, b);
  });
}

/**
 * Sort metrics in alphabetical order
 * @param metrics Array of metric names
 * @returns Sorted array of metric names in alphabetical order
 */
export function sortMetricsAlphabetically(metrics: string[]): string[] {
  return [...metrics].sort((a, b) => localeCompare(a, b));
}

/**
 * Sort metrics with recent metrics first (by recency), then alphabetically
 * @param metrics Array of metric names
 * @returns Sorted array of metric names
 */
export function sortMetricsWithRecentFirst(metrics: string[]): string[] {
  const allRecentMetrics = getRecentMetrics().map((m) => m.name);
  const allRecentMetricsSet = new Set(allRecentMetrics);
  const [recent, nonRecent] = metrics.reduce<[string[], string[]]>(
    ([recent, nonRecent], metric) => {
      if (allRecentMetricsSet.has(metric)) {
        recent.push(metric);
      } else {
        nonRecent.push(metric);
      }
      return [recent, nonRecent];
    },
    [[], []]
  );
  const sortedNonRecent = sortMetricsAlphabetically(nonRecent);
  // `recentMetrics` are already sorted by recency, so we just need to filter them
  const sortedRecent = allRecentMetrics.filter((m) => recent.includes(m));

  return [...sortedRecent, ...sortedNonRecent];
}
