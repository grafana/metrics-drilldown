import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { MetricExpr, parser, PipelineExpr, Selector } from '@grafana/lezer-logql';
import { getBackendSrv, type BackendSrvRequest, type FetchResponse } from '@grafana/runtime';
import { type SyntaxNode } from '@lezer/common';
import { lastValueFrom } from 'rxjs';

import { createMetricsLogsConnector, type FoundLokiDataSource } from './base';
import { findHealthyLokiDataSources } from '../../RelatedLogs/RelatedLogsScene';

export interface RecordingRuleGroup {
  name: string;
  rules: RecordingRule[];
}

export interface RecordingRule {
  name: string;
  query: string;
  type: 'recording' | 'alerting' | string;
  labels?: Record<string, string>;
}

export interface ExtractedRecordingRule extends RecordingRule {
  datasource: FoundLokiDataSource;
  hasMultipleOccurrences?: boolean;
}

export interface ExtractedRecordingRules {
  [dataSourceUID: string]: ExtractedRecordingRule[];
}

/**
 * Fetch Loki recording rule groups from the specified datasource.
 *
 * @param datasourceSettings - The settings of the datasource instance.
 * @returns A promise that resolves to an array of recording rule groups.
 */
async function fetchRecordingRuleGroups(datasourceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
  const recordingRuleUrl = `api/prometheus/${datasourceSettings.uid}/api/v1/rules`;
  const recordingRules: BackendSrvRequest = { url: recordingRuleUrl, showErrorAlert: false, showSuccessAlert: false };
  const res = await lastValueFrom<
    FetchResponse<{
      data: { groups: RecordingRuleGroup[] };
    }>
  >(getBackendSrv().fetch(recordingRules));

  if (!res.ok) {
    console.warn(`Failed to fetch recording rules from Loki data source: ${datasourceSettings.name}`);
    return [];
  }

  return res.data.data.groups;
}

/**
 * Extract recording rules from the provided rule groups and associate them with the given data source.
 *
 * @param ruleGroups - An array of recording rule groups to extract rules from.
 * @param ds - The data source instance settings to associate with the extracted rules.
 * @returns An array of extracted recording rules, each associated with the provided data source.
 */
export function extractRecordingRulesFromRuleGroups(
  ruleGroups: RecordingRuleGroup[],
  ds: DataSourceInstanceSettings<DataSourceJsonData>
): ExtractedRecordingRule[] {
  if (ruleGroups.length === 0) {
    return [];
  }

  // We only want to return the first matching rule when there are multiple rules with same name
  const extractedRules = new Map<string, ExtractedRecordingRule>();
  ruleGroups.forEach((rg) => {
    rg.rules
      .filter((r) => r.type === 'recording')
      .forEach(({ type, name, query }) => {
        const isExist = extractedRules.has(name);
        if (isExist) {
          // We already have the rule.
          const existingRule = extractedRules.get(name);
          if (existingRule) {
            existingRule.hasMultipleOccurrences = true;
            extractedRules.set(name, existingRule);
          }
        } else {
          extractedRules.set(name, {
            type,
            name,
            query,
            datasource: {
              name: ds.name,
              uid: ds.uid,
            },
            hasMultipleOccurrences: false,
          });
        }
      });
  });

  return Array.from(extractedRules.values());
}

/**
 * Retrieve an array of Loki data sources that contain recording rules with the specified metric name.
 *
 * @param metricName - The name of the metric to search for within the recording rules.
 * @param extractedRecordingRules - An object containing extracted recording rules, where each key is a string and the value is an array of recording rules.
 * @returns An array of `FoundLokiDataSource` objects that contain recording rules with the specified metric name.
 */
export function getDataSourcesWithRecordingRulesContainingMetric(
  metricName: string,
  extractedRecordingRules: ExtractedRecordingRules
): FoundLokiDataSource[] {
  const foundLokiDataSources: FoundLokiDataSource[] = [];
  Object.values(extractedRecordingRules).forEach((recRules) => {
    recRules
      .filter((rr) => rr.name === metricName)
      .forEach((rr) => {
        foundLokiDataSources.push(rr.datasource);
      });
  });

  return foundLokiDataSources;
}

/**
 * Generate a Loki query string for a related metric based on the provided metric name, data source ID,
 * and extracted recording rules.
 *
 * @param metricName - The name of the metric for which to generate the Loki query.
 * @param dataSourceUid - The UID of the data source containing the recording rules.
 * @param extractedRecordingRules - An object containing recording rules, indexed by data source UID.
 * @returns The generated Loki query string, or an empty string if the data source UID or metric name is not found.
 */
export function getLokiQueryForRelatedMetric(
  metricName: string,
  dataSourceUid: string,
  extractedRecordingRules: ExtractedRecordingRules
): string {
  if (!dataSourceUid || !extractedRecordingRules[dataSourceUid]) {
    return '';
  }
  const targetRule = extractedRecordingRules[dataSourceUid].find((rule) => rule.name === metricName);
  if (!targetRule) {
    return '';
  }
  const lokiQuery = getLogQueryFromMetricsQuery(targetRule.query);

  return lokiQuery;
}

/**
 * Fetch and extract Loki recording rules from all Loki data sources.
 *
 * @returns {Promise<ExtractedRecordingRules>} A promise that resolves to an object containing
 * the extracted recording rules, keyed by data source UID.
 *
 * @throws Will log an error to the console if fetching or extracting rules fails for any data source.
 */
export async function fetchAndExtractLokiRecordingRules() {
  const lokiDataSources = await findHealthyLokiDataSources();
  const extractedRecordingRules: ExtractedRecordingRules = {};
  await Promise.all(
    lokiDataSources.map(async (dataSource) => {
      try {
        const ruleGroups: RecordingRuleGroup[] = await fetchRecordingRuleGroups(dataSource);
        const extractedRules = extractRecordingRulesFromRuleGroups(ruleGroups, dataSource);
        extractedRecordingRules[dataSource.uid] = extractedRules;
      } catch (err) {
        console.warn(err);
      }
    })
  );

  return extractedRecordingRules;
}

const createLokiRecordingRulesConnector = () => {
  let lokiRecordingRules: ExtractedRecordingRules = {};

  return createMetricsLogsConnector({
    name: 'lokiRecordingRules',
    async getDataSources(selectedMetric: string): Promise<FoundLokiDataSource[]> {
      lokiRecordingRules = await fetchAndExtractLokiRecordingRules();
      const lokiDataSources = getDataSourcesWithRecordingRulesContainingMetric(selectedMetric, lokiRecordingRules);

      return lokiDataSources;
    },

    getLokiQueryExpr(selectedMetric: string, datasourceUid: string): string {
      return getLokiQueryForRelatedMetric(selectedMetric, datasourceUid, lokiRecordingRules);
    },
  });
};

export const lokiRecordingRulesConnector = createLokiRecordingRulesConnector();

/**
 * Returns whether the given query is a logs query (not a metrics query)
 * A query that's at least 3 characters long and doesn't contain a MetricExpr node is considered a logs query
 */
function isLogsQuery(query: string): boolean {
  if (query.trim().length <= 2) {
    return false;
  }

  let hasMetricExpr = false;
  const tree = parser.parse(query);

  tree.iterate({
    enter: ({ type }): false | void => {
      if (type.id === MetricExpr) {
        hasMetricExpr = true;
        return false;
      }
    },
  });

  return !hasMetricExpr;
}

/**
 * Gets a node of the specified type from a LogQL query string
 * Returns undefined if no node of that type is found
 */
function getNodeFromQuery(query: string, nodeType: number): SyntaxNode | undefined {
  let foundNode: SyntaxNode | undefined;
  const tree = parser.parse(query);

  tree.iterate({
    enter: (node): false | void => {
      if (node.type.id === nodeType) {
        foundNode = node.node;
        return false;
      }
    },
  });

  return foundNode;
}

/**
 * Extracts the underlying log query from a metrics query
 * For metrics queries, it returns the selector and pipeline parts
 * For logs queries, it returns the original query unchanged
 * Returns an empty string if no valid query can be extracted
 *
 * @example
 * // Returns '{foo="bar"} |= "error"'
 * getLogQueryFromMetricsQuery('rate({foo="bar"} |= "error"[5m])')
 *
 * // Returns '{foo="bar"}'
 * getLogQueryFromMetricsQuery('sum(rate({foo="bar"}[5m]))')
 *
 * // Returns original query unchanged
 * getLogQueryFromMetricsQuery('{foo="bar"} |= "error"')
 */
export function getLogQueryFromMetricsQuery(query: string): string {
  // If it's already a logs query, return as-is
  if (isLogsQuery(query)) {
    return query;
  }

  // Get the selector node which contains the log query matchers
  const selectorNode = getNodeFromQuery(query, Selector);
  if (!selectorNode) {
    return '';
  }

  const selector = query.substring(selectorNode.from, selectorNode.to);

  // Get the pipeline expression node if it exists (contains filters, parsers etc.)
  const pipelineExprNode = getNodeFromQuery(query, PipelineExpr);
  const pipelineExpr = pipelineExprNode ? query.substring(pipelineExprNode.from, pipelineExprNode.to) : '';

  // Combine selector with pipeline expression if it exists
  return `${selector} ${pipelineExpr}`.trim();
}
