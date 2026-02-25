import { t } from '@grafana/i18n';
import { getBackendSrv, type BackendSrvRequest } from '@grafana/runtime';
import { type Dashboard, type Panel } from '@grafana/schema';
import { limitFunction } from 'p-limit';

import { displayWarning } from 'MetricsReducer/helpers/displayStatus';
import { logger } from 'shared/logger/logger';

import { isPrometheusDataSource } from '../../../../shared/utils/utils.datasource';
import { extractMetricNames } from '../../../../shared/utils/utils.promql';

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

    if (dashboards.length >= 500) {
      checkDashboardLimitExceeded();
    }

    let dashboardRequestsFailedCount = 0;

    const metricCounts = await Promise.all(
      dashboards.map(({ uid, url }) => getDashboardLimited(uid, url, dashboardRequestsFailedCount))
    ).then(async (response) => await parseDashboardSearchResponse(response));

    return metricCounts;
  } catch (err) {
    const error = typeof err === 'string' ? new Error(err) : (err as Error);
    logger.error(error, {
      message: t('fetch-dashboard-metrics.error', 'Failed to fetch dashboard metrics'),
    });
    return {};
  }
}

function checkDashboardLimitExceeded() {
  getBackendSrv()
    .get<DashboardSearchItem[]>(
      '/api/search',
      {
        type: 'dash-db',
        limit: 500,
        page: 2,
      },
      'grafana-metricsdrilldown-app-dashboard-limit-check',
      usageRequestOptions
    )
    .then((response) => {
      if (response.length > 0) {
        displayWarning([
          t(
            'fetch-dashboard-metrics.limit-warning-title',
            'Dashboard usage sort is limited to 500 dashboards.'
          ),
          t(
            'fetch-dashboard-metrics.limit-warning-body',
            'Your organization has more dashboards than this limit. Usage counts may be incomplete.'
          ),
        ]);
      }
    })
    .catch((error) => {
      logger.warn('Failed to check dashboard count', error);
    });
}

function getDashboardsWithPanels(
  dashboardSearchResponse: Array<DashboardWithUrl | null>
): Array<DashboardWithUrl & { panels: NonNullable<Panel[]> }> {
  return dashboardSearchResponse.filter((dashboard) => dashboard && dashboard?.panels?.length) as Array<
    DashboardWithUrl & { panels: NonNullable<Panel[]> }
  >;
}

function getPanelsWithTargets(panels: Panel[]): Array<Panel & { targets: NonNullable<Panel['targets']> }> {
  return panels.filter(
    (panel) => isPrometheusDataSource(panel.datasource) && 'targets' in panel && panel.targets?.length
  ) as Array<Panel & { targets: NonNullable<Panel['targets']> }>;
}

function processTargetsForMetrics(
  targets: NonNullable<Panel['targets']>,
  dashboardName: string,
  dashboardUid: string,
  dashboardUrl: string,
  dashboardData: Record<string, MetricUsageDetails>
): void {
  for (const target of targets) {
    const expr = typeof target.expr === 'string' ? target.expr : '';
    const metrics = extractMetricNames(expr);

    for (const metric of metrics) {
      updateMetricUsage(metric, dashboardName, dashboardUid, dashboardUrl, dashboardData);
    }
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

async function parseDashboardSearchResponse(
  dashboardSearchResponse: Array<DashboardWithUrl | null>
): Promise<MetricUsageMap> {
  // Create a map to track metric names and their usage details
  const dashboardData: Record<string, MetricUsageDetails> = {};

  for (const dashboard of getDashboardsWithPanels(dashboardSearchResponse)) {
    for (const panel of getPanelsWithTargets(dashboard.panels)) {
      await processTargetsForMetrics(
        panel.targets,
        dashboard.title || `Dashboard ${dashboard.uid}`,
        dashboard.uid || 'unknown',
        dashboard.url,
        dashboardData
      );
    }
  }

  return dashboardData;
}
