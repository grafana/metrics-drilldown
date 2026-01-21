import { type AdHocVariableFilter, type DataSourceApi } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import React, { useEffect, useRef } from 'react';

import { ErrorView } from 'App/ErrorView';
import { Trail } from 'App/Routes';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { VAR_WINGMAN_SORT_BY } from 'MetricsReducer/list-controls/MetricsSorter/MetricsSorter';
import { metricFilters } from 'MetricsReducer/SideBar/SideBar';
import { logger } from 'shared/logger/logger';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { embeddedTrailNamespace, newMetricsTrail } from 'shared/utils/utils';
import { labelMatcherToAdHocFilter } from 'shared/utils/utils.variables';

import { parsePromQLQuery } from '../../extensions/links';
import { type ParsedPromQLQuery, type PromQLLabelMatcher } from '../../shared/utils/utils.promql';
import { toSceneTimeRange } from '../../shared/utils/utils.timerange';

/**
 * Extracts the prefix from a Prometheus metric name.
 * The prefix is the first part of the metric name before any separator (underscore or colon).
 * Example: "grafana_slo_threshold_expression" → "grafana"
 *          "traces_spanmetrics_calls_total" → "traces"
 */
function extractMetricPrefix(metricName: string): string {
  // Match up to the first non-alphanumeric character (typically underscore or colon)
  const match = metricName.match(/^([a-zA-Z0-9]+)/);
  return match ? match[1] : metricName;
}

/**
 * Extracts unique prefixes from an array of metric names.
 */
function extractUniquePrefixes(metricNames: string[]): string[] {
  const prefixes = new Set(metricNames.map(extractMetricPrefix));
  return Array.from(prefixes);
}



type SourceMetricsScenario = 'single_source_metric' | 'multiple_source_metrics' | 'recording_rule_fallback' | 'missing_metric_information';

function getSourceMetricsScenario(sourceMetrics?: Array<{ metricName: string; labels: PromQLLabelMatcher[] }>, parsedPromQLQuery?: ParsedPromQLQuery): SourceMetricsScenario {
  if ((!sourceMetrics || sourceMetrics.length === 0) && parsedPromQLQuery) {
    return 'recording_rule_fallback';
  }

  if (sourceMetrics && sourceMetrics.length === 1) {
    return 'single_source_metric';
  }

  if (sourceMetrics && sourceMetrics.length > 1) {
    return 'multiple_source_metrics';
  }


  return 'missing_metric_information';
};

export interface SourceMetricsProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
  sourceMetrics?: Array<{
    metricName: string;
    labels: PromQLLabelMatcher[];
  }>;
}

const KnowledgeGraphSourceMetrics = ({
  query,
  initialStart,
  initialEnd,
  dataSource,
  sourceMetrics,
}: SourceMetricsProps) => {
  const [error] = useCatchExceptions();
  const initRef = useRef(false);

  const hasSourceMetrics = sourceMetrics && sourceMetrics.length > 0;

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('exposed_component_viewed', { component: 'knowledge_graph_source_metrics' });
    }
  }, []);

  const parsedPromQLQuery = parsePromQLQuery(query);

  // Determine metric and filters based on data source
  let metric: string | undefined;
  let initialFilters: AdHocVariableFilter[] | undefined;

  const scenario = getSourceMetricsScenario(sourceMetrics);
  switch (scenario) {
    case 'recording_rule_fallback':
      // When sourceMetrics aren't provided, fall back to
      // selecting the metric from the provided PromQL query.
      metric = parsedPromQLQuery.metric;
      initialFilters = parsedPromQLQuery.labels.map((label) => labelMatcherToAdHocFilter(label));
      break;
    case 'single_source_metric':
      // If there's a single source metric, select it.
      metric = sourceMetrics![0].metricName;
      initialFilters = sourceMetrics![0].labels.map((label) => labelMatcherToAdHocFilter(label));
      break;
    case 'multiple_source_metrics':
      // If there are multiple source metrics, we display
      // the source metrics in the MetricsReducer, allowing
      // users to select from the filtered list of metrics.
      initialFilters = sourceMetrics![0].labels.map((label) => labelMatcherToAdHocFilter(label));
      
      // Extract unique prefixes from sourceMetrics to filter the metrics list
      // This naturally excludes metrics like "asserts_*" and "ALERTS*" that aren't in sourceMetrics
      const prefixesToExclude = ['asserts', 'ALERTS'];
      const sourceMetricPrefixes = hasSourceMetrics
        ? extractUniquePrefixes(sourceMetrics.map((m) => m.metricName)).filter((metric) =>
            prefixesToExclude.every((excludedPrefix) => !metric.startsWith(excludedPrefix))
          )
        : undefined;

      // Set URL params for prefix filters BEFORE creating the trail
      // This leverages Scenes' built-in URL sync in MetricsFilterSection
      if (sourceMetricPrefixes?.length) {
        const prefixUrlParam = `${embeddedTrailNamespace}-${metricFilters.prefix}`;
        locationService.partial({ [prefixUrlParam]: sourceMetricPrefixes.join(',') }, true);

        const sortByUrlParam = `${embeddedTrailNamespace}-var-${VAR_WINGMAN_SORT_BY}`;
        locationService.partial({ [sortByUrlParam]: 'alphabetical' }, true);
      }
      break;
    case 'missing_metric_information':
      const err = new Error('Missing metric information for Knowledge Graph insight');
      logger.error(err, { query });
      return <ErrorView error={err} />;
  }

  // Create trail with behaviors:
  // 1. Filter asserts labels from breakdown
  // 2. Default histogram visualizations to percentiles (leveraging existing presets)
  const trail = newMetricsTrail({
    metric,
    initialDS: dataSource.uid,
    initialFilters,
    $timeRange: toSceneTimeRange(initialStart, initialEnd),
    embedded: true,
  });

  return (
    <div data-testid="metrics-drilldown-embedded-label-breakdown">
      {error ? <ErrorView error={error} /> : <Trail trail={trail} />}
    </div>
  );
};

export default KnowledgeGraphSourceMetrics;
