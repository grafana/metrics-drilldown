import {
  FieldType,
  LoadingState,
  type DataQueryResponse,
  type DataSourceApi,
  type LegacyMetricFindQueryOptions,
  type MetricFindValue,
  type TestDataSourceResponse,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { RuntimeDataSource, sceneGraph, type DataSourceVariable, type SceneObject } from '@grafana/scenes';

import { MetricDatasourceHelper } from 'helpers/MetricDatasourceHelper';
import { VAR_DATASOURCE } from 'shared';
import { isPrometheusRule } from 'WingmanDataTrail/helpers/isPrometheusRule';

import type { PrometheusDatasource } from '@grafana/prometheus';

export const NULL_GROUP_BY_VALUE = '(none)';

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

    const ds = (await MetricsWithLabelValueDataSource.getPrometheusDataSource(sceneObject)) as PrometheusDatasource;
    if (!ds) {
      return [];
    }

    const timeRange = sceneGraph.getTimeRange(sceneObject).state.value;
    let metricsList: string[] = [];

    const removeRules = query.startsWith('removeRules');
    const matcher = removeRules ? query.replace('removeRules', '') : query;

    if (MetricDatasourceHelper.datasourceUsesTimeRangeInLanguageProviderMethods(ds)) {
      // @ts-expect-error: Ignoring type error due to breaking change in fetchSeriesValuesWithMatch signature
      metricsList = await ds.languageProvider.fetchSeriesValuesWithMatch(timeRange, '__name__', matcher);
    } else {
      metricsList = await ds.languageProvider.fetchSeriesValuesWithMatch('__name__', matcher);
    }

    if (removeRules) {
      metricsList = metricsList.filter((metricName) => !isPrometheusRule(metricName));
    }

    return metricsList.map((metricName) => ({ value: metricName, text: metricName }));
  }

  static async getPrometheusDataSource(sceneObject: SceneObject): Promise<DataSourceApi | undefined> {
    try {
      const dsVariable = sceneGraph.findByKey(sceneObject, VAR_DATASOURCE) as DataSourceVariable;
      const uid = (dsVariable?.state.value as string) ?? '';

      return await getDataSourceSrv().get({ uid });
    } catch (error) {
      console.error('Error getting Prometheus data source!');
      console.error(error);

      return undefined;
    }
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    return {
      status: 'success',
      message: 'OK',
    };
  }
}
