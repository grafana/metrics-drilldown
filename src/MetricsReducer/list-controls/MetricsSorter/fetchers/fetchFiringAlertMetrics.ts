import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';

import { ensureErrorObject } from 'App/errorUtils';
import { logger } from 'shared/logger/logger';

import { GRAFANA_RULER_RULES_URL, usageRequestOptions } from './shared';
import { extractMetricNames } from '../../../../shared/utils/utils.promql';

/**
 * Prometheus-compatible ruler API response shape.
 * Returned by GET /api/prometheus/grafana/api/v1/rules
 *
 * Fields are typed as optional where parseFiringRules defensively checks
 * for their presence, so the types reflect the actual runtime guarantees.
 */
interface RulerRulesResponse {
  status?: string;
  data?: {
    groups?: RuleGroup[];
  };
}

interface RuleGroup {
  name?: string;
  file?: string;
  rules?: Rule[];
  interval?: number;
}

interface Rule {
  type?: string;
  name?: string;
  query?: unknown;
  state?: string;
  health?: string;
  alerts?: unknown[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  duration?: number;
}

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
      GRAFANA_RULER_RULES_URL,
      { state: 'firing', limit_alerts: 0 },
      'grafana-metricsdrilldown-app-firing-alert-metric-usage',
      usageRequestOptions
    );

    return parseFiringRules(response);
  } catch (err) {
    logger.error(ensureErrorObject(err, 'Failed to fetch firing alert rules'), {
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

    const alertingRules = group.rules.filter(
      (rule): rule is Rule & { name: string; query: string } =>
        rule.type === 'alerting' && typeof rule.query === 'string' && rule.query !== ''
    );

    for (const rule of alertingRules) {
      countMetricsFromRule(rule, metricCounts);
    }
  }

  return metricCounts;
}

function countMetricsFromRule(rule: Rule & { name: string; query: string }, metricCounts: Map<string, number>): void {
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
