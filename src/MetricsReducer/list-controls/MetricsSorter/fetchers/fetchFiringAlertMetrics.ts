import { t } from '@grafana/i18n';
import { getBackendSrv, type BackendSrvRequest } from '@grafana/runtime';

import { logger } from 'shared/logger/logger';

import { extractMetricNames } from '../../../../shared/utils/utils.promql';

/**
 * Prometheus-compatible ruler API response shape.
 * Returned by GET /api/prometheus/grafana/api/v1/rules
 */
interface RulerRulesResponse {
  status: string;
  data: {
    groups: RuleGroup[];
  };
}

interface RuleGroup {
  name: string;
  file: string;
  rules: Rule[];
  interval: number;
}

interface Rule {
  type: 'alerting' | 'recording';
  name: string;
  query: string;
  state?: string;
  health?: string;
  alerts?: unknown[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  duration?: number;
}

const usageRequestOptions: Partial<BackendSrvRequest> = {
  showSuccessAlert: false,
  showErrorAlert: false,
} as const;

/**
 * Fetches currently firing alert rules from Grafana's Prometheus-compatible ruler endpoint
 * and maps them to metric names.
 *
 * Uses the `?state=firing` server-side filter to reduce payload size, and `limit_alerts=0`
 * to skip individual alert instance details.
 *
 * @returns A Map of metric name → count of firing alert rules that reference the metric
 */
export async function fetchFiringAlertMetrics(): Promise<Map<string, number>> {
  try {
    const response = await getBackendSrv().get<RulerRulesResponse>(
      '/api/prometheus/grafana/api/v1/rules',
      { state: 'firing', limit_alerts: 0 },
      'grafana-metricsdrilldown-app-firing-alert-metric-usage',
      usageRequestOptions
    );

    return parseFiringRules(response);
  } catch (err) {
    const error = typeof err === 'string' ? new Error(err) : (err as Error);
    logger.error(error, {
      message: t(
        'fetch-firing-alert-metrics.error',
        'Failed to fetch firing alert rules from Prometheus ruler endpoint'
      ),
    });
    return new Map();
  }
}

function parseFiringRules(response: RulerRulesResponse): Map<string, number> {
  const metricCounts = new Map<string, number>();

  const groups = response?.data?.groups;
  if (!Array.isArray(groups)) {
    return metricCounts;
  }

  for (const group of groups) {
    if (!Array.isArray(group?.rules)) {
      continue;
    }

    for (const rule of group.rules) {
      // Only process alerting rules, skip recording rules
      if (rule.type !== 'alerting') {
        continue;
      }

      if (typeof rule.query !== 'string' || rule.query === '') {
        continue;
      }

      try {
        const metrics = extractMetricNames(rule.query);

        for (const metric of metrics) {
          metricCounts.set(metric, (metricCounts.get(metric) || 0) + 1);
        }
      } catch (error) {
        logger.warn(error, {
          message: `Failed to parse PromQL expression in firing alert rule ${rule.name}`,
        });
      }
    }
  }

  return metricCounts;
}
