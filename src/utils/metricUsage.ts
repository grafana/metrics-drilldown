import { getBackendSrv } from '@grafana/runtime';
import { type Dashboard, type DataSourceRef } from '@grafana/schema';
import { parser } from '@prometheus-io/lezer-promql';

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

/**
 * Fetches metric usage data from dashboards
 * @returns A record mapping metric names to their occurrence count in dashboards
 */
export async function fetchDashboardMetrics(): Promise<Record<string, number>> {
  const dashboards = await getBackendSrv().get<DashboardSearchItem[]>('/api/search', {
    type: 'dash-db',
    limit: 1000,
  });

  const metricCounts = await Promise.all(
    dashboards.map(({ uid }) => getBackendSrv().get<{ dashboard: Dashboard }>(`/api/dashboards/uid/${uid}`))
  ).then((dashboards) => {
    // Create a map to count metric occurrences
    const counts: Record<string, number> = {};

    for (const { dashboard } of dashboards) {
      if (!dashboard.panels?.length || !dashboard.uid) {
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
    const alertingRules = await getBackendSrv().get<AlertingRule[]>('/api/v1/provisioning/alert-rules');

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
 * Sort metrics by their usage score (descending)
 * @param metrics Array of metric names
 * @param usageScores Usage scores for metrics
 * @returns Sorted array of metric names
 */
export function sortMetricsByUsage(metrics: string[], usageScores: Record<string, number>): string[] {
  return [...metrics].sort((a, b) => {
    const scoreA = usageScores[a] || 0;
    const scoreB = usageScores[b] || 0;

    // Primary sort by score (descending)
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // Secondary sort alphabetically for metrics with the same score
    return a.localeCompare(b);
  });
}

/**
 * Sort metrics alphabetically
 * @param metrics Array of metric names
 * @returns Sorted array of metric names
 */
export function sortMetricsAlphabetically(metrics: string[]): string[] {
  return [...metrics].sort((a, b) => a.localeCompare(b));
}

/**
 * Sort metrics in reverse alphabetical order
 * @param metrics Array of metric names
 * @returns Sorted array of metric names in reverse alphabetical order
 */
export function sortMetricsReverseAlphabetically(metrics: string[]): string[] {
  return [...metrics].sort((a, b) => b.localeCompare(a));
}
