import { getBackendSrv, type BackendSrvRequest } from '@grafana/runtime';

import { extractMetricNames } from './extractMetricNames';
import { logger } from '../../../../tracking/logger/logger';

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
          logger.warn(error, {
            message: `Failed to parse PromQL expression in alert rule ${rule.title}`,
          });
        }
      }
    }

    return metricCounts;
  } catch (err) {
    const error = typeof err === 'string' ? new Error(err) : (err as Error);
    logger.error(error, {
      message: 'Failed to fetch alerting rules',
    });
    // Return empty object when fetch fails
    return {};
  }
}
