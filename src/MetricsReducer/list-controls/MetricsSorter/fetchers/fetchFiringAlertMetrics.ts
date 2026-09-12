import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';

import { ensureErrorObject } from 'App/errorUtils';
import { logger } from 'shared/logger/logger';
import { reportExploreMetrics } from 'shared/tracking/interactions';

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

export interface FiringAlertRuleSignals {
  status: 'ready' | 'error';
  metricCounts: Map<string, number>;
  /** SLO UUID → severities found on currently firing rules. */
  firingSloUuids: Map<string, Set<string>>;
  ruleCount: number;
}

/**
 * Fetches currently firing alert rules from Grafana's Prometheus-compatible ruler endpoint.
 * The normalized result retains both source metric counts and canonical SLO labels so consumers
 * can share one ruler request without coupling SLO detection to generated recording metric names.
 */
export async function fetchFiringAlertRuleSignals(): Promise<FiringAlertRuleSignals> {
  const start = performance.now();

  try {
    const response = await getBackendSrv().get<RulerRulesResponse>(
      GRAFANA_RULER_RULES_URL,
      { state: 'firing', limit_alerts: 0 },
      'grafana-metricsdrilldown-app-firing-alert-metric-usage',
      usageRequestOptions
    );

    const result = parseFiringRules(response);
    const durationMs = Math.round(performance.now() - start);

    reportExploreMetrics('firing_alert_metrics_fetched', {
      status: 'success',
      duration_ms: durationMs,
      metric_count: result.metricCounts.size,
      rule_count: result.ruleCount,
    });

    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);

    reportExploreMetrics('firing_alert_metrics_fetched', {
      status: 'error',
      duration_ms: durationMs,
      metric_count: 0,
      rule_count: 0,
    });

    logger.error(ensureErrorObject(err, 'Failed to fetch firing alert rules'), {
      message: t(
        'fetch-firing-alert-metrics.error',
        'Failed to fetch firing alert rules from Prometheus ruler endpoint'
      ),
    });
    return { status: 'error', metricCounts: new Map(), firingSloUuids: new Map(), ruleCount: 0 };
  }
}

/** @returns A Map of metric name → count of firing alert rules that reference the metric. */
export async function fetchFiringAlertMetrics(): Promise<Map<string, number>> {
  return (await fetchFiringAlertRuleSignals()).metricCounts;
}

function parseFiringRules(response: RulerRulesResponse): FiringAlertRuleSignals {
  const metricCounts = new Map<string, number>();
  const firingSloUuids = new Map<string, Set<string>>();
  let ruleCount = 0;

  const groups = response?.data?.groups;
  if (!Array.isArray(groups)) {
    return { status: 'ready', metricCounts, firingSloUuids, ruleCount };
  }

  for (const group of groups) {
    if (!Array.isArray(group?.rules)) {
      continue;
    }

    const alertingRules = group.rules.filter((rule) => rule.type === 'alerting');
    const alertingRulesWithQueries = alertingRules.filter(
      (rule): rule is Rule & { name: string; query: string } =>
        typeof rule.name === 'string' && typeof rule.query === 'string' && rule.query !== ''
    );

    ruleCount += alertingRulesWithQueries.length;

    for (const rule of alertingRules) {
      if (rule.state === 'firing') {
        retainSloLabels(rule, firingSloUuids);
      }
    }
    for (const rule of alertingRulesWithQueries) {
      countMetricsFromRule(rule, metricCounts);
    }
  }

  return { status: 'ready', metricCounts, firingSloUuids, ruleCount };
}

function retainSloLabels(rule: Rule, firingSloUuids: Map<string, Set<string>>): void {
  const uuid = rule.labels?.grafana_slo_uuid;
  if (!uuid) {
    return;
  }

  const severities = firingSloUuids.get(uuid) ?? new Set<string>();
  const severity = rule.labels?.grafana_slo_severity;
  if (severity) {
    severities.add(severity);
  }
  firingSloUuids.set(uuid, severities);
}

function countMetricsFromRule(rule: Rule & { name: string; query: string }, metricCounts: Map<string, number>): void {
  try {
    // Safety net: the lezer PromQL parser is tolerant and won't throw on malformed
    // strings, but we keep this catch for unexpected failures in extractMetricNames.
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
