import { getBackendSrv, type BackendSrvRequest } from '@grafana/runtime';
import { type Dashboard, type Panel } from '@grafana/schema';
import { limitFunction } from 'p-limit';

import { logger } from '../../../../tracking/logger/logger';
import { isPrometheusDataSource } from '../../../../utils/utils.datasource';
import { extractMetricNames } from '../../../../utils/utils.promql';

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

export type MetricUsageDetails =
  | { usageType: 'dashboard-usage'; count: number; dashboards: Record<string, number> } // e.g., {"Dashboard A": 2, "Dashboard B": 1}
  | { usageType: 'alerting-usage'; count: number }; // TODO: implement `alerts: Record<string, number>`

type MetricUsageMap = Record<string, MetricUsageDetails>;

const usageRequestOptions: Partial<BackendSrvRequest> = {
  showSuccessAlert: false,
  showErrorAlert: false,
} as const;

const dashboardRequestMap = new Map<string, Promise<Dashboard | null>>();

const getDashboardLimited = limitFunction(
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
        .then(({ dashboard }) => dashboard)
        .catch((error) => {
          // Prevent excessive noise
          if (dashboardRequestsFailedCount <= 5) {
            logger.error(error, { dashboardUid });
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
 * @returns A record mapping metric names to their dashboard usage data
 */
export async function fetchDashboardMetrics(): Promise<Record<string, MetricUsageDetails>> {
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
      dashboards.map(({ uid: dashboardUid }) => getDashboardLimited(dashboardUid, dashboardRequestsFailedCount))
    ).then(parseDashboardSearchResponse);

    return metricCounts;
  } catch (err) {
    const error = typeof err === 'string' ? new Error(err) : (err as Error);
    logger.error(error, {
      message: 'Failed to fetch dashboard metrics',
    });
    return {};
  }
}

function parseDashboardSearchResponse(dashboardSearchResponse: Array<Dashboard | null>): MetricUsageMap {
  // Create a map to track metric names and their usage details
  const dashboardData: Record<string, MetricUsageDetails> = {};

  const relevantDashboards = dashboardSearchResponse.filter(
    (dashboard) => dashboard && dashboard?.panels?.length
  ) as Array<Dashboard & { panels: NonNullable<Panel[]> }>;
  // Note: For each dashboard, for each panel in that dashboard, for each query in that panel, what metrics does that query use
  for (const dashboard of relevantDashboards) {
    const dashboardName = dashboard.title || `Dashboard ${dashboard.uid}`;
    // Skip panels with non-Prometheus data sources
    const relevantPanels = dashboard.panels.filter(
      (panel) => isPrometheusDataSource(panel.datasource) && 'targets' in panel && panel.targets?.length
    ) as Array<Panel & { targets: NonNullable<Panel['targets']> }>;

    for (const panel of relevantPanels) {
      for (const target of panel.targets) {
        const expr = typeof target.expr === 'string' ? target.expr : '';

        const metrics = extractMetricNames(expr); // Note: This is an array of metric names used in the query

        // Count each metric occurrence
        for (const metric of metrics) {
          if (!dashboardData[metric]) {
            dashboardData[metric] = { usageType: 'dashboard-usage', count: 0, dashboards: {} };
          }

          dashboardData[metric].count++;
          if (dashboardData[metric].usageType === 'dashboard-usage') {
            dashboardData[metric].dashboards[dashboardName] =
              (dashboardData[metric].dashboards[dashboardName] || 0) + 1;
          }
        }
      }
    }
  }

  return dashboardData;
}
