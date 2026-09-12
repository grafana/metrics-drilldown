import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';

import { ensureErrorObject } from 'App/errorUtils';
import { isSloTrackingEnabled } from 'shared/featureFlags/openFeature';
import { logger } from 'shared/logger/logger';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { getPluginVersion } from 'shared/utils/getPluginVersion';
import { extractMetricNames } from 'shared/utils/utils.promql';

import { fetchFiringAlertRuleSignals, type FiringAlertRuleSignals } from './fetchFiringAlertMetrics';
import { SLO_PLUGIN_ID, SLO_RESOURCE_URL, usageRequestOptions } from './shared';

export { SLO_PLUGIN_ID, SLO_RESOURCE_URL } from './shared';

export type SloMetricSignalsStatus = 'disabled' | 'plugin-absent' | 'ready' | 'error';

export interface SloMetricSignals {
  datasourceUid: string;
  status: SloMetricSignalsStatus;
  /** Source metric → SLO UUIDs whose definitions reference it. */
  trackedMetrics: Map<string, Set<string>>;
  /** Tracked source metrics owned by an SLO with a currently firing burn rule. */
  activeBurnMetrics: Set<string>;
}

type FetchFiringSignals = () => Promise<FiringAlertRuleSignals>;

interface SloListResponse {
  slos?: unknown[];
}

interface SloDatasource {
  uid?: string;
  type?: string;
}

const PROMETHEUS_DATASOURCE_TYPES = new Set([
  'prometheus',
  'mimir',
  'grafana-amazonprometheus-datasource',
  'grafana-azureprometheus-datasource',
]);

function emptyResult(datasourceUid: string, status: SloMetricSignalsStatus): SloMetricSignals {
  return {
    datasourceUid,
    status,
    trackedMetrics: new Map(),
    activeBurnMetrics: new Set(),
  };
}

/**
 * Fetches SLO definitions for the selected datasource and joins them to firing burn rules by
 * `grafana_slo_uuid`. Optional-integration failures are returned as data so the metrics list can
 * remain usable without treating an error as a valid empty definition list.
 */
export async function fetchSloMetricSignals(
  datasourceUid: string,
  fetchFiringSignals: FetchFiringSignals = fetchFiringAlertRuleSignals
): Promise<SloMetricSignals> {
  const start = performance.now();

  if (!(await isSloTrackingEnabled())) {
    return reportResult(emptyResult(datasourceUid, 'disabled'), start, 0);
  }

  if (!(await getPluginVersion(SLO_PLUGIN_ID))) {
    return reportResult(emptyResult(datasourceUid, 'plugin-absent'), start, 0);
  }

  try {
    const [response, firingSignals] = await Promise.all([
      getBackendSrv().get<SloListResponse>(
        SLO_RESOURCE_URL,
        undefined,
        'grafana-metricsdrilldown-app-slo-metric-signals',
        usageRequestOptions
      ),
      fetchFiringSignals(),
    ]);

    if (!Array.isArray(response?.slos)) {
      throw new Error('Unexpected SLO list response');
    }
    if (firingSignals.status === 'error') {
      throw new Error('Failed to acquire active SLO burn signals');
    }

    const definitions = response.slos;
    const trackedMetrics = extractTrackedMetrics(definitions, datasourceUid);
    const firingUuids = new Set(firingSignals.firingSloUuids.keys());
    const activeBurnMetrics = new Set<string>();

    for (const [metric, sloUuids] of trackedMetrics) {
      if ([...sloUuids].some((uuid) => firingUuids.has(uuid))) {
        activeBurnMetrics.add(metric);
      }
    }

    return reportResult(
      { datasourceUid, status: 'ready', trackedMetrics, activeBurnMetrics },
      start,
      definitions.length
    );
  } catch (error) {
    logger.error(ensureErrorObject(error, 'Failed to fetch SLO metric signals'), {
      message: t('fetch-slo-metric-signals.error', 'Failed to fetch SLO definitions'),
    });
    return reportResult(emptyResult(datasourceUid, 'error'), start, 0);
  }
}

function reportResult(result: SloMetricSignals, start: number, definitionCount: number): SloMetricSignals {
  reportExploreMetrics('slo_metric_signals_fetched', {
    status: result.status,
    duration_ms: Math.round(performance.now() - start),
    definition_count: definitionCount,
    metric_count: result.trackedMetrics.size,
    active_burn_metric_count: result.activeBurnMetrics.size,
  });
  return result;
}

export function extractTrackedMetrics(definitions: unknown[], datasourceUid: string): Map<string, Set<string>> {
  const trackedMetrics = new Map<string, Set<string>>();

  for (const definition of definitions) {
    if (
      !isRecord(definition) ||
      typeof definition.uuid !== 'string' ||
      definition.uuid.length === 0 ||
      !isRecord(definition.query)
    ) {
      continue;
    }

    const expressions = getDefinitionExpressions(definition, datasourceUid);
    for (const expression of expressions) {
      try {
        for (const metric of extractMetricNames(expression)) {
          const sloUuids = trackedMetrics.get(metric) ?? new Set<string>();
          sloUuids.add(definition.uuid);
          trackedMetrics.set(metric, sloUuids);
        }
      } catch (error) {
        logger.warn(error, {
          message: t('fetch-slo-metric-signals.parse-error', 'Failed to extract a metric name from an SLO definition'),
        });
      }
    }
  }

  return trackedMetrics;
}

function getDefinitionExpressions(definition: Record<string, unknown>, datasourceUid: string): string[] {
  const query = definition.query as Record<string, unknown>;
  if (query.type === 'grafanaQueries') {
    return getGrafanaQueryExpressions(query.grafanaQueries, datasourceUid);
  }

  const queryType = typeof query.type === 'string' ? query.type : '';
  const branchValue = query[queryType];
  const branch = isRecord(branchValue) ? branchValue : undefined;
  if (!branch || !isMatchingPrometheusDatasource(getSourceDatasource(definition, branch), datasourceUid)) {
    return [];
  }

  return getNativeDefinitionExpressions(query.type, branch);
}

function isMatchingPrometheusDatasource(source: SloDatasource | undefined, datasourceUid: string): boolean {
  return source?.uid === datasourceUid && (source.type === undefined || isPrometheusDatasourceType(source.type));
}

function getNativeDefinitionExpressions(type: unknown, branch: Record<string, unknown>): string[] {
  switch (type) {
    case 'ratio':
      return [getPrometheusMetric(branch.successMetric), getPrometheusMetric(branch.totalMetric)].filter(isString);
    case 'failureRatio':
      return [getPrometheusMetric(branch.failureMetric), getPrometheusMetric(branch.totalMetric)].filter(isString);
    case 'threshold':
      return typeof branch.thresholdExpression === 'string' ? [branch.thresholdExpression] : [];
    case 'failureThreshold':
      return typeof branch.failureThresholdExpression === 'string' ? [branch.failureThresholdExpression] : [];
    case 'freeform':
      return typeof branch.query === 'string' ? [branch.query] : [];
    default:
      return [];
  }
}

function getSourceDatasource(
  definition: Record<string, unknown>,
  branch: Record<string, unknown>
): SloDatasource | undefined {
  const readOnly = isRecord(definition.readOnly) ? definition.readOnly : undefined;
  const resolvedSource = readOnly && isRecord(readOnly.sourceDatasource) ? readOnly.sourceDatasource : undefined;
  if (typeof resolvedSource?.uid === 'string') {
    return {
      uid: resolvedSource.uid,
      type: typeof resolvedSource.type === 'string' ? resolvedSource.type : undefined,
    };
  }
  if (typeof branch.sourceDatasourceUid === 'string') {
    return { uid: branch.sourceDatasourceUid };
  }
  const destination = isRecord(definition.destinationDatasource) ? definition.destinationDatasource : undefined;
  if (typeof destination?.uid !== 'string') {
    return undefined;
  }
  return {
    uid: destination.uid,
    type: typeof destination.type === 'string' ? destination.type : undefined,
  };
}

function getGrafanaQueryExpressions(value: unknown, datasourceUid: string): string[] {
  if (!isRecord(value) || !Array.isArray(value.grafanaQueries)) {
    return [];
  }

  return value.grafanaQueries.flatMap((query) => {
    if (!isRecord(query) || typeof query.expr !== 'string' || typeof query.expression === 'string') {
      return [];
    }

    const datasource = getGrafanaQueryDatasource(query);
    if (!datasource || datasource.uid !== datasourceUid || !isPrometheusDatasourceType(datasource.type)) {
      return [];
    }

    return [query.expr];
  });
}

function getGrafanaQueryDatasource(query: Record<string, unknown>): SloDatasource | undefined {
  if (isRecord(query.datasource)) {
    return {
      uid: typeof query.datasource.uid === 'string' ? query.datasource.uid : undefined,
      type: typeof query.datasource.type === 'string' ? query.datasource.type : undefined,
    };
  }

  if (typeof query.datasourceUid === 'string' && typeof query.datasourceType === 'string') {
    return { uid: query.datasourceUid, type: query.datasourceType };
  }

  return undefined;
}

function isPrometheusDatasourceType(type: string | undefined): boolean {
  return type !== undefined && PROMETHEUS_DATASOURCE_TYPES.has(type);
}

function getPrometheusMetric(value: unknown): string | undefined {
  return isRecord(value) && typeof value.prometheusMetric === 'string' ? value.prometheusMetric : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}
