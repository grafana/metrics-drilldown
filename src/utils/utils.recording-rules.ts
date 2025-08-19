import { type DataSourceApi } from '@grafana/data';
import { getBackendSrv, type BackendSrvRequest, type FetchResponse } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

import { recordingRulesCache } from '../services/recordingRulesCache';

export interface PrometheusRuleGroup {
  name: string;
  rules: PrometheusRule[];
}

export interface PrometheusRule {
  type: 'recording' | 'alerting';
  name: string;
  query: string;
}

export interface ExtractedPrometheusRule extends PrometheusRule {
  datasource: {
    name: string;
    uid: string;
  };
}

/**
 * Fetch Prometheus recording rule groups from the specified datasource.
 *
 * @param datasourceSettings - The settings of the datasource instance.
 * @returns A promise that resolves to an array of recording rule groups.
 */
export async function fetchPrometheusRuleGroups(datasourceSettings: DataSourceApi): Promise<PrometheusRuleGroup[]> {
  const rulesUrl = `api/prometheus/${datasourceSettings.uid}/api/v1/rules`;
  const rulesRequest: BackendSrvRequest = {
    url: rulesUrl,
    showErrorAlert: false,
    showSuccessAlert: false,
  };

  try {
    const res = await lastValueFrom<
      FetchResponse<{
        data: { groups: PrometheusRuleGroup[] };
      }>
    >(getBackendSrv().fetch(rulesRequest));

    if (!res.ok) {
      throw new Error(`Failed to fetch recording rules from Prometheus data source: ${datasourceSettings.name}`);
    }

    return res.data.data.groups;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Extract recording rules from the provided rule groups and associate them with the given data source.
 *
 * @param ruleGroups - An array of recording rule groups to extract rules from.
 * @param ds - The data source instance settings to associate with the extracted rules.
 * @returns An array of extracted recording rules, each associated with the provided data source.
 */
export function extractRecordingRulesFromPrometheusRuleGroups(
  ruleGroups: PrometheusRuleGroup[],
  ds: DataSourceApi
): ExtractedPrometheusRule[] {
  if (ruleGroups.length === 0) {
    return [];
  }

  const extractedRules: ExtractedPrometheusRule[] = [];
  const datasource = { name: ds.name, uid: ds.uid };

  ruleGroups.forEach((rg) => {
    rg.rules
      .filter((r) => r.type === 'recording')
      .forEach(({ type, name, query }) => {
        extractedRules.push({
          type,
          name,
          query,
          datasource,
        });
      });
  });

  return extractedRules;
}

/**
 * Find a specific recording rule by name from the provided data source.
 *
 * This function uses an optimized cache with O(1) lookups to avoid repeatedly fetching
 * large recording rules datasets and performing expensive array searches.
 * The cache persists beyond component lifecycle but clears on browser refresh.
 *
 * @param metricName - The name of the recording rule to find.
 * @param datasourceSettings - The data source instance settings.
 * @returns A promise that resolves to the found recording rule or null if not found.
 */
export async function findRecordingRuleByName(
  metricName: string,
  datasourceSettings: DataSourceApi
): Promise<ExtractedPrometheusRule | null> {
  try {
    // Direct O(1) lookup using optimized cache
    return await recordingRulesCache.getRecordingRule(metricName, datasourceSettings);
  } catch {
    // Error logging is handled by the cache service
    return null;
  }
}

/**
 * Checks if a metric name follows Prometheus recording rule naming conventions.
 *
 * @remarks Recording rules follow the pattern: `level:metric:operations` or `level:metric`.
 * The `level` component might be empty. Where `level` and `operations` can contain
 * underscores and alphanumeric characters. The `metric` part can contain any character, but can't be empty.
 */
export function isRecordingRule(value: string): boolean {
  // Matches patterns like:
  // - instance_path:requests:rate5m
  // - path:requests:rate5m
  // - job:request_failures_per_requests:ratio_rate5m
  // - apiserver_request:availability30d
  // - asserts:container_memory
  // - :requests:rate5m
  return /^\w*:.*?(?::\w+)?$/.test(value);
}
