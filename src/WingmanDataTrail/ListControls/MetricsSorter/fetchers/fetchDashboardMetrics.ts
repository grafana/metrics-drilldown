import { getBackendSrv, type BackendSrvRequest } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { limitFunction } from 'p-limit';

import { logger } from 'tracking/logger/logger';
import { isPrometheusDataSource } from 'utils/utils.datasource';

import { extractMetricNames } from './extractMetricNames';

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

const usageRequestOptions: Partial<BackendSrvRequest> = {
  showSuccessAlert: false,
  showErrorAlert: false,
} as const;

const dashboardRequestMap = new Map<string, Promise<{ dashboard: Dashboard } | null>>();

const limitedFunction = limitFunction(
  async (dashboardUid: string, dashboardRequestsFailedCount: number) => {
    let promise = dashboardRequestMap.get(dashboardUid);

    if (!promise) {
      promise = getBackendSrv()
        .get<{ dashboard: Dashboard }>(
          `/api/dashboards/uid/${dashboardUid}`,
          undefined,
          `grafana-metricsdrilldown-app-dashboard-metric-usage-${dashboardUid}`,
          usageRequestOptions
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
  },
  { concurrency: 50 }
);

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
      usageRequestOptions
    );

    let dashboardRequestsFailedCount = 0;

    const metricCounts = await Promise.all(
      dashboards.map(({ uid: dashboardUid }) => limitedFunction(dashboardUid, dashboardRequestsFailedCount))
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
  } catch (err) {
    const error = typeof err === 'string' ? new Error(err) : (err as Error);
    logger.error(error, {
      message: 'Failed to fetch dashboard metrics',
    });
    return {};
  }
}
