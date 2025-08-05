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
  | {
      usageType: 'dashboard-usage';
      count: number;
      dashboards: Record<string, { count: number; uid: string; url: string }>;
    } // e.g., {"Dashboard A": { count: 2, uid: "123" }}
  | { usageType: 'alerting-usage'; count: number }; // TODO: implement `alerts: Record<string, number>`

type MetricUsageMap = Record<string, MetricUsageDetails>;

const usageRequestOptions: Partial<BackendSrvRequest> = {
  showSuccessAlert: false,
  showErrorAlert: false,
} as const;

type DashboardWithUrl = Dashboard & { url: string };

const dashboardRequestMap = new Map<string, Promise<DashboardWithUrl | null>>();

const getDashboardLimited = limitFunction(
  async (dashboardUid: string, url, dashboardRequestsFailedCount: number) => {
    let promise = dashboardRequestMap.get(dashboardUid);

    if (!promise) {
      promise = getBackendSrv()
        .get<{ dashboard: Dashboard }>(
          `/api/dashboards/uid/${dashboardUid}`,
          undefined,
          `grafana-metricsdrilldown-app-dashboard-metric-usage-${dashboardUid}`,
          usageRequestOptions
        )
        .then(({ dashboard }) => ({ ...dashboard, url } as DashboardWithUrl))
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
      dashboards.map(({ uid, url }) => getDashboardLimited(uid, url, dashboardRequestsFailedCount))
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

function updateMetricUsage(
  metric: string,
  dashboardName: string,
  dashboardUid: string,
  dashboardUrl: string,
  dashboardData: Record<string, MetricUsageDetails>
): void {
  if (!dashboardData[metric]) {
    dashboardData[metric] = { usageType: 'dashboard-usage', count: 0, dashboards: {} };
  }

  dashboardData[metric].count++;
  if (dashboardData[metric].usageType === 'dashboard-usage') {
    dashboardData[metric].dashboards[dashboardName] = {
      count: (dashboardData[metric].dashboards[dashboardName]?.count || 0) + 1,
      uid: dashboardUid || 'unknown',
      url: dashboardUrl,
    };
  }
}

function parseDashboardSearchResponse(dashboardSearchResponse: Array<DashboardWithUrl | null>): MetricUsageMap {
  // Create a map to track metric names and their usage details
  const dashboardData: Record<string, MetricUsageDetails> = {};

  const relevantDashboards = dashboardSearchResponse.filter(
    (dashboard) => dashboard && dashboard?.panels?.length
  ) as Array<DashboardWithUrl & { panels: NonNullable<Panel[]> }>;
  // For each dashboard, for each panel in that dashboard, for each query in that panel, what metrics does that query use
  for (const dashboard of relevantDashboards) {
    const dashboardName = dashboard.title || `Dashboard ${dashboard.uid}`;
    // Skip panels with non-Prometheus data sources
    const relevantPanels = dashboard.panels.filter(
      (panel) => isPrometheusDataSource(panel.datasource) && 'targets' in panel && panel.targets?.length
    ) as Array<Panel & { targets: NonNullable<Panel['targets']> }>;

    for (const panel of relevantPanels) {
      for (const target of panel.targets) {
        const expr = typeof target.expr === 'string' ? target.expr : '';

        const metrics = extractMetricNames(expr); // Array of metric names used in the query

        // Count each metric occurrence
        for (const metric of metrics) {
          updateMetricUsage(metric, dashboardName, dashboard.uid || 'unknown', dashboard.url, dashboardData);
        }
      }
    }
  }
  return dashboardData;
}
