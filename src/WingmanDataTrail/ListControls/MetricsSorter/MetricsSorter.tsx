import { getBackendSrv, type BackendSrvRequest } from '@grafana/runtime';
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
import { type Dashboard, type DataSourceRef } from '@grafana/schema';
import { parser } from '@prometheus-io/lezer-promql';
import React from 'react';

import { localeCompare } from 'WingmanDataTrail/helpers/localCompare';

import { EventSortByChanged } from './EventSortByChanged';
import { logger } from '../../../tracking/logger/logger';

export type SortingOption = 'default' | 'dashboard-usage' | 'alerting-usage';

const RECENT_METRICS_STORAGE_KEY = 'metrics-drilldown-recent-metrics/v1';
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
    localStorage.setItem(RECENT_METRICS_STORAGE_KEY, JSON.stringify(updatedMetrics));
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
    const stored = localStorage.getItem(RECENT_METRICS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const recentMetrics: RecentMetric[] = JSON.parse(stored);
    const now = Date.now();
    const thirtyDaysAgo = now - RECENT_METRICS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    // Filter out expired metrics
    const validMetrics = recentMetrics.filter((metric) => metric.timestamp > thirtyDaysAgo);

    // If any metrics were removed, update storage
    if (validMetrics.length !== recentMetrics.length) {
      localStorage.setItem(RECENT_METRICS_STORAGE_KEY, JSON.stringify(validMetrics));
    }

    return validMetrics;
  } catch (error) {
    console.error('Failed to get recent metrics:', error);
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

    this._subs.add(
      sortByVar.subscribeToState((newState, prevState) => {
        if (!this.supportedSortByOptions.has(newState.value as SortingOption)) {
          // Migration for the old sortBy values
          sortByVar.changeValueTo('default');
        } else if (newState.value !== prevState.value) {
          this.publishEvent(new EventSortByChanged({ sortBy: newState.value as SortingOption }), true);
        }
      })
    );
  }

  public static Component = ({ model }: SceneComponentProps<MetricsSorter>) => {
    const { inputControls } = model.useState();

    return <inputControls.Component model={inputControls} data-testid="sort-by-select" />;
  };
}

/**
 * Extracts all metric names from a PromQL expression
 * @param {string} promqlExpression - The PromQL expression to parse
 * @returns {string[]} An array of unique metric names found in the expression
 */
export function extractMetricNames(promqlExpression: string): string[] {
  const tree = parser.parse(promqlExpression);
  const metricNames = new Set<string>();
  const cursor = tree.cursor();

  do {
    // when we find a VectorSelector...
    if (cursor.type.is('VectorSelector')) {
      // go to its first child
      if (cursor.firstChild()) {
        do {
          // look for the Identifier node
          if (cursor.type.is('Identifier')) {
            const metricName = promqlExpression.slice(cursor.from, cursor.to);
            metricNames.add(metricName);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.next());

  return Array.from(metricNames);
}

/**
 * Helper function to determine if a datasource is a Prometheus datasource
 */
export function isPrometheusDataSource(input: unknown): input is Required<Pick<DataSourceRef, 'type' | 'uid'>> {
  return (
    typeof input === 'object' &&
    input !== null &&
    'type' in input &&
    input.type === 'prometheus' &&
    'uid' in input &&
    typeof input.uid === 'string'
  );
}

interface DashboardSearchItem {
  id: number;
  uid: string;
  title: string;
  url: string;
  folderTitle?: string;
  folderUid?: string;
  tags: string[];
  isStarred: boolean;
}

const requestOptions: Partial<BackendSrvRequest> = {
  showSuccessAlert: false,
  showErrorAlert: false,
};
const dashboardRequestMap = new Map<string, Promise<{ dashboard: Dashboard } | null>>();

/**
 * Fetches metric usage data from dashboards
 * @returns A record mapping metric names to their occurrence count in dashboards
 */
export async function fetchDashboardMetrics(): Promise<Record<string, number>> {
  try {
    const dashboards = await getBackendSrv().get<DashboardSearchItem[]>(
      '/api/search',
      {
        type: 'dash-db',
        limit: 500,
      },
      'grafana-metricsdrilldown-app-dashboard-search',
      requestOptions
    );

    let dashboardRequestsFailedCount = 0;

    const metricCounts = await Promise.all(
      dashboards.map(({ uid: dashboardUid }) => {
        let promise = dashboardRequestMap.get(dashboardUid);

        if (!promise) {
          promise = getBackendSrv()
            .get<{ dashboard: Dashboard }>(
              `/api/dashboards/uid/${dashboardUid}`,
              undefined,
              `grafana-metricsdrilldown-app-dashboard-metric-usage-${dashboardUid}`,
              requestOptions
            )
            .catch((error) => {
              // Prevent excessive noise
              if (dashboardRequestsFailedCount <= 5) {
                logger.error(error, {
                  dashboardUid,
                });
              }

              dashboardRequestsFailedCount++;
              return Promise.resolve(null);
            })
            .finally(() => {
              dashboardRequestMap.delete(dashboardUid);
            });
          dashboardRequestMap.set(dashboardUid, promise);
        }

        return promise;
      })
    ).then((dashboardSearchResponse) => {
      // Create a map to count metric occurrences
      const counts: Record<string, number> = {};
      const dashboards = dashboardSearchResponse.filter((d): d is { dashboard: Dashboard } => d !== null);

      for (const { dashboard } of dashboards) {
        if (!dashboard.panels?.length) {
          continue;
        }

        for (const panel of dashboard.panels) {
          const { datasource } = panel;
          if (!isPrometheusDataSource(datasource) || !('targets' in panel) || !panel.targets?.length) {
            continue;
          }

          for (const target of panel.targets) {
            const expr = typeof target.expr === 'string' ? target.expr : '';
            const metrics = extractMetricNames(expr);

            // Count each metric occurrence
            for (const metric of metrics) {
              if (!metric) {
                continue;
              }

              counts[metric] = (counts[metric] || 0) + 1;
            }
          }
        }
      }

      return counts;
    });

    return metricCounts;
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error);
    return {};
  }
}

interface AlertingRule {
  id: number;
  uid: string;
  title: string;
  data: Array<{
    refId: string;
    queryType: string;
    datasourceUid: string;
    model: {
      expr?: string;
      expression?: string;
      type?: string;
      datasource?: {
        type: string;
        uid: string;
      };
    };
  }>;
}

/**
 * Fetches metric usage data from alerting rules
 * @returns A record mapping metric names to their occurrence count in alerting rules
 */
export async function fetchAlertingMetrics(): Promise<Record<string, number>> {
  try {
    const alertingRules = await getBackendSrv().get<AlertingRule[]>(
      '/api/v1/provisioning/alert-rules',
      undefined,
      'grafana-metricsdrilldown-app-alert-rule-metric-usage',
      requestOptions
    );

    // Create a map to count metric occurrences
    const metricCounts: Record<string, number> = {};

    // Process each alert rule
    for (const rule of alertingRules) {
      if (!rule.data?.length) {
        continue;
      }

      // Process each query in the rule
      for (const query of rule.data) {
        // Skip non-Prometheus queries or expression queries (like threshold or reduce expressions)
        if (!query.model || query.datasourceUid === '__expr__') {
          continue;
        }

        // Extract expression from the model
        const expr = query.model.expr;
        if (!expr || typeof expr !== 'string') {
          continue;
        }

        try {
          // Extract metrics from the PromQL expression
          const metrics = extractMetricNames(expr);

          // Count each metric occurrence
          for (const metric of metrics) {
            if (!metric) {
              continue;
            }

            metricCounts[metric] = (metricCounts[metric] || 0) + 1;
          }
        } catch (error) {
          // Log parsing errors but continue processing other expressions
          console.warn(`Failed to parse PromQL expression in alert rule ${rule.title}:`, error);
        }
      }
    }

    return metricCounts;
  } catch (error) {
    console.error('Failed to fetch alerting rules:', error);
    // Return empty object when fetch fails
    return {};
  }
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
