import {
  FieldType,
  LoadingState,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceApi,
  type LegacyMetricFindQueryOptions,
  type MetricFindValue,
  type TestDataSourceResponse,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { RuntimeDataSource, sceneGraph, type DataSourceVariable, type SceneObject } from '@grafana/scenes';

import { localeCompare } from '../helpers/localCompare';

export const NULL_GROUP_BY_VALUE = '(none)';

export class LabelsDataSource extends RuntimeDataSource {
  static uid = 'grafana-prometheus-labels-datasource';

  constructor() {
    super('grafana-prometheus-labels-datasource', LabelsDataSource.uid);
  }

  async query(request: DataQueryRequest): Promise<DataQueryResponse> {
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

  async metricFindQuery(matcher: string, options: LegacyMetricFindQueryOptions): Promise<MetricFindValue[]> {
    const sceneObject = options.scopedVars?.__sceneObject?.valueOf() as SceneObject;

    const ds = await LabelsDataSource.getPrometheusDataSource(sceneObject);
    if (!ds) {
      return [];
    }

    const response = await ds.languageProvider.fetchLabelsWithMatch(matcher);

    const labelOptions = Object.entries(response)
      .filter(([key]) => !key.startsWith('__'))
      .map(([key, value]) => ({ value: key, text: value || key }))
      .sort((a, b) => localeCompare(a.value as string, b.value as string));

    return [{ value: NULL_GROUP_BY_VALUE, text: '(none)' }, ...labelOptions] as MetricFindValue[];
  }

  static async getPrometheusDataSource(sceneObject: SceneObject): Promise<DataSourceApi | undefined> {
    try {
      const dsVariable = sceneGraph.getVariables(sceneObject).getByName('ds') as DataSourceVariable;
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
