import {
  FieldType,
  LoadingState,
  type DataQueryResponse,
  type LegacyMetricFindQueryOptions,
  type MetricFindValue,
  type TestDataSourceResponse,
} from '@grafana/data';
import { RuntimeDataSource, sceneGraph, type SceneObject } from '@grafana/scenes';

import { MetricDatasourceHelper } from 'helpers/MetricDatasourceHelper';
import { isPrometheusRule } from 'WingmanDataTrail/helpers/isPrometheusRule';

export class SearchableMetricsDataSource extends RuntimeDataSource {
  static readonly uid = 'grafana-prometheus-searchable-metrics-datasource';

  constructor() {
    super(SearchableMetricsDataSource.uid, SearchableMetricsDataSource.uid);
  }

  async query(): Promise<DataQueryResponse> {
    return {
      state: LoadingState.Done,
      data: [
        {
          name: 'Metrics',
          fields: [
            {
              name: null,
              type: FieldType.other,
              values: [],
              config: {},
            },
          ],
          length: 0,
        },
      ],
    };
  }

  async metricFindQuery(query: string, options: LegacyMetricFindQueryOptions): Promise<MetricFindValue[]> {
    const sceneObject = options.scopedVars?.__sceneObject?.valueOf() as SceneObject;

    const ds = await MetricDatasourceHelper.getPrometheusDataSourceForScene(sceneObject);
    if (!ds) {
      return [];
    }

    const timeRange = sceneGraph.getTimeRange(sceneObject).state.value;
    let metricsList: string[] = [];

    // Parse the search pattern from query (format: "searchPattern" or "all-metrics")
    const removeRules = query.includes('removeRules');
    let searchPattern = removeRules ? query.replace('removeRules', '') : query;
    
    // Handle special "all-metrics" query as no search pattern
    if (searchPattern === 'all-metrics') {
      searchPattern = '';
    }

    // Build matcher for Prometheus API with search pattern and adhoc filters
    const matcher = this.buildPrometheusMatcherWithSearch(searchPattern, sceneObject);

    // Fetch metrics using Prometheus API with match[] parameter
    metricsList = await MetricDatasourceHelper.fetchLabelValues({
      ds,
      labelName: '__name__',
      matcher,
      timeRange,
    });

    if (removeRules) {
      metricsList = metricsList.filter((metricName) => !isPrometheusRule(metricName));
    }

    return metricsList.map((metricName) => ({ value: metricName, text: metricName }));
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    return {
      status: 'success',
      message: 'OK',
    };
  }

  /**
   * Build the Prometheus matcher that includes both search pattern and existing filters
   * This follows the same pattern as MetricsWithLabelValueDataSource
   */
  private buildPrometheusMatcherWithSearch(searchPattern: string, sceneObject: SceneObject): string {
    // Get existing filters from the adhoc variable (like original code does)
    const filtersExpr = sceneGraph.interpolate(sceneObject, '${filters}', {});
    
    if (!searchPattern || !searchPattern.trim()) {
      // No search pattern - use adhoc filters or empty matcher for all metrics
      // When both search and filters are empty, use empty string to get all metrics
      return filtersExpr ? `{${filtersExpr}}` : '';
    }

    // Has search pattern - escape and create name filter
    const escapedPattern = this.escapeRegex(searchPattern.trim());
    const nameFilter = `__name__=~".*${escapedPattern}.*"`;

    if (!filtersExpr || filtersExpr.trim() === '') {
      // Only search pattern, no adhoc filters
      return `{${nameFilter}}`;
    }

    // Combine search pattern with existing adhoc filters
    return `{${nameFilter},${filtersExpr}}`;
  }

  /**
   * Escape regex special characters in search text
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
