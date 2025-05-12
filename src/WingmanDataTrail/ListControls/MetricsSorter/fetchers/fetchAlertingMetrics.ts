import { getBackendSrv, type BackendSrvRequest } from '@grafana/runtime';

import { logger } from '../../../../tracking/logger/logger';
import { extractMetricNames } from '../../../../utils/utils.promql';

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

const usageRequestOptions: Partial<BackendSrvRequest> = {
  showSuccessAlert: false,
  showErrorAlert: false,
} as const;

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
      usageRequestOptions
    );

    return parseAlertingRules(alertingRules);
  } catch (err) {
    const error = typeof err === 'string' ? new Error(err) : (err as Error);
    logger.error(error, {
      message: 'Failed to fetch alerting rules',
    });
    // Return empty object when fetch fails
    return {};
  }
}

function parseAlertingRules(alertingRules: AlertingRule[]): Record<string, number> {
  // Create a map to count metric occurrences
  const metricCounts: Record<string, number> = {};

  const relevantRules = alertingRules.filter((rule) => rule?.data.length > 0);

  for (const rule of relevantRules) {
    // Skip non-Prometheus queries or expression queries (like threshold or reduce expressions)
    const prometheusQueries = rule.data.filter(
      (query) => typeof query.model?.expr === 'string' && query.datasourceUid !== '__expr__'
    );

    for (const query of prometheusQueries) {
      try {
        // Extract metrics from the PromQL expression
        const metrics = extractMetricNames(query.model.expr as string);

        // Count each metric occurrence
        for (const metric of metrics) {
          metricCounts[metric] = (metricCounts[metric] || 0) + 1;
        }
      } catch (error) {
        // Log parsing errors but continue processing other expressions
        logger.warn(error, {
          message: `Failed to parse PromQL expression in alert rule ${rule.title}`,
        });
      }
    }
  }

  return metricCounts;
}
