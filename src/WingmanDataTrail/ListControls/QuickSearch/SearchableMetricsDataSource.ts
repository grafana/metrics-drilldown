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

    // Parse the search pattern from query (format: "searchPattern")
    const removeRules = query.includes('removeRules');
    const searchPattern = removeRules ? query.replace('removeRules', '') : query;

    // Build matcher for Prometheus API - this is the key part!
    const matcher = this.buildPrometheusMatcherWithSearch(searchPattern, sceneObject);

    // Use the MetricDatasourceHelper which correctly calls the Prometheus API
    metricsList = await MetricDatasourceHelper.fetchLabelValues({
      ds,
      labelName: '__name__',
      matcher, // This becomes the match[] parameter
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
      // No search - return the filters expression wrapped in braces (same as original MetricsVariable)
      return filtersExpr ? `{${filtersExpr}}` : '';
    }

    // Escape regex special characters
    const escapedPattern = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameFilter = `__name__=~".*${escapedPattern}.*"`;

    if (!filtersExpr || filtersExpr.trim() === '') {
      // Only search pattern, no existing filters - wrap in braces
      return `{${nameFilter}}`;
    }

    // Combine search pattern with existing filters - wrap in braces
    // This creates: {__name__=~"pattern",existing_filters}
    return `{${nameFilter},${filtersExpr}}`;
  }
}
