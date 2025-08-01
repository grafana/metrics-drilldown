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

export class MetricsWithLabelValueDataSource extends RuntimeDataSource {
  static readonly uid = 'grafana-prometheus-metrics-with-label-values-datasource';

  constructor() {
    super(MetricsWithLabelValueDataSource.uid, MetricsWithLabelValueDataSource.uid);
  }

  async query(): Promise<DataQueryResponse> {
    return {
      state: LoadingState.Done,
      data: [
        {
          name: 'Labels',
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

    const removeRules = query.startsWith('removeRules');
    const matcher = removeRules ? query.replace('removeRules', '') : query;

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
}
