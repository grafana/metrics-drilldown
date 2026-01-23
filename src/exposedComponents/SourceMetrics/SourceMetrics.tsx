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

import { FilterGroupByAssertsLabelsBehavior } from './behaviors/FilterGroupByAssertsLabelsBehavior';
import { HistogramPercentilesDefaultBehavior } from './behaviors/HistogramPercentilesDefaultBehavior';
import { parsePromQLQuery } from '../../extensions/links';
import { type PromQLLabelMatcher } from '../../shared/utils/utils.promql';
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

/**
 * Captures the possible scenarios / data combinations for the Source Metrics experience.
 * This discriminated union gives us type safety for the different scenarios, and prevents us
 * from needing to use type assertions or null checks in the KnowledgeGraphSourceMetrics component.
 *
 * `fallbackQuery` typically contains an `asserts:*` recording rule metric and labels.
 */
type SourceMetricsScenario =
  | {
      scenario: 'recording_rule_fallback';
      sourceMetrics: undefined;
      fallbackQuery: ReturnType<typeof parsePromQLQuery>;
    }
  | {
      scenario: 'single_source_metric';
      sourceMetrics: SourceMetrics;
      fallbackQuery: undefined;
    }
  | {
      scenario: 'multiple_source_metrics';
      sourceMetrics: SourceMetrics;
      fallbackQuery: undefined;
    }
  | {
      scenario: 'missing_metric_information';
      sourceMetrics: undefined;
      fallbackQuery: undefined;
    };

function getSourceMetricsScenario(props: Pick<SourceMetricsProps, 'query' | 'sourceMetrics'>): SourceMetricsScenario {
  if (props.sourceMetrics && props.sourceMetrics.length > 0) {
    return {
      scenario: props.sourceMetrics.length === 1 ? 'single_source_metric' : 'multiple_source_metrics',
      sourceMetrics: props.sourceMetrics,
      fallbackQuery: undefined,
    };
  }

  let fallbackQuery: ReturnType<typeof parsePromQLQuery> | undefined = undefined;

  if (props.query) {
    try {
      fallbackQuery = parsePromQLQuery(props.query);
    } catch (error) {
      logger.error(new Error(`Failed to parse PromQL query: ${error}`), { query: props.query });
    }
  }

  if (fallbackQuery) {
    return {
      scenario: 'recording_rule_fallback',
      sourceMetrics: undefined,
      fallbackQuery,
    };
  }

  return { scenario: 'missing_metric_information', sourceMetrics: undefined, fallbackQuery: undefined };
}

type SourceMetrics = Array<{
  metricName: string;
  labels: PromQLLabelMatcher[];
}>;

export interface SourceMetricsProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
  sourceMetrics?: SourceMetrics;
}

const KnowledgeGraphSourceMetrics = (props: SourceMetricsProps) => {
  const [error] = useCatchExceptions();
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('exposed_component_viewed', { component: 'knowledge_graph_source_metrics' });
    }
  }, []);

  // Determine metric and filters based on data source
  let metric: string | undefined;
  let initialFilters: AdHocVariableFilter[] | undefined;

  const { scenario, sourceMetrics, fallbackQuery } = getSourceMetricsScenario(props);
  switch (scenario) {
    case 'single_source_metric':
      // If there's a single source metric, select it.
      metric = sourceMetrics[0].metricName;
      initialFilters = sourceMetrics[0].labels.map((label) => labelMatcherToAdHocFilter(label));
      break;
    case 'multiple_source_metrics':
      // If there are multiple source metrics, we display
      // the source metrics in the MetricsReducer, allowing
      // users to select from the filtered list of metrics.
      initialFilters = sourceMetrics[0].labels.map((label) => labelMatcherToAdHocFilter(label));

      // Extract unique prefixes from sourceMetrics to filter the metrics list
      // This naturally excludes metrics like "asserts_*" and "ALERTS*" that aren't in sourceMetrics
      const prefixesToExclude = ['asserts', 'ALERTS'];
      const sourceMetricPrefixes = extractUniquePrefixes(sourceMetrics.map((m) => m.metricName)).filter((metric) =>
        prefixesToExclude.every((excludedPrefix) => !metric.startsWith(excludedPrefix))
      );

      // Set URL params for prefix filters BEFORE creating the trail
      // This leverages Scenes' built-in URL sync in MetricsFilterSection
      if (sourceMetricPrefixes?.length) {
        const prefixUrlParam = `${embeddedTrailNamespace}-${metricFilters.prefix}`;
        locationService.partial({ [prefixUrlParam]: sourceMetricPrefixes.join(',') }, true);

        const sortByUrlParam = `${embeddedTrailNamespace}-var-${VAR_WINGMAN_SORT_BY}`;
        locationService.partial({ [sortByUrlParam]: 'alphabetical' }, true);
      }
      break;
    case 'recording_rule_fallback':
      // When sourceMetrics aren't provided, fall back to
      // selecting the metric from the provided PromQL query.
      metric = fallbackQuery.metric;
      initialFilters = fallbackQuery.labels.map((label) => labelMatcherToAdHocFilter(label));
      break;
    case 'missing_metric_information':
      const err = new Error('Missing metric information for Knowledge Graph insight');
      logger.error(err, { query: props.query });
      return <ErrorView error={err} />;
  }

  // Create trail with behaviors:
  // 1. Filter asserts labels from breakdown
  // 2. Default histogram visualizations to percentiles (leveraging existing presets)
  const trail = newMetricsTrail({
    metric,
    initialDS: props.dataSource.uid,
    initialFilters,
    $timeRange: toSceneTimeRange(props.initialStart, props.initialEnd),
    embedded: true,
    $behaviors: [new FilterGroupByAssertsLabelsBehavior({ metric }), new HistogramPercentilesDefaultBehavior()],
  });

  return (
    <div data-testid="metrics-drilldown-embedded-label-breakdown">
      {error ? <ErrorView error={error} /> : <Trail trail={trail} />}
    </div>
  );
};

export default KnowledgeGraphSourceMetrics;
