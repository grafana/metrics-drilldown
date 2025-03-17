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

import { VAR_DATASOURCE, VAR_FILTERS, VAR_FILTERS_EXPR } from 'shared';
import { isAdHocFiltersVariable } from 'utils/utils.variables';

import { localeCompare } from '../helpers/localCompare';

import type { PrometheusDatasource } from '@grafana/prometheus';

// TODO can we get rid of it?
export const NULL_GROUP_BY_VALUE = '(none)';

export class LabelsDataSource extends RuntimeDataSource {
  static uid = 'grafana-prometheus-labels-datasource';

  constructor() {
    super(LabelsDataSource.uid, LabelsDataSource.uid);
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

    const ds = (await LabelsDataSource.getPrometheusDataSource(sceneObject)) as PrometheusDatasource;
    if (!ds) {
      return [];
    }

    const [, labelName] = matcher.match(/valuesOf\((.+)\)/) ?? [];

    if (labelName) {
      const labelValues = await LabelsDataSource.fetchLabelValues(labelName, sceneObject);

      return labelValues.map((value) => ({ value, text: value }));
    }

    // make an empty array
    let labelOptions;

    // there is probably a more graceful way to implement this, but this is what the DS offers us.
    // if a DS does not support the labels match API, we need getTagKeys to handle the empty matcher
    if (ds.hasLabelsMatchAPISupport()) {
      const response = await ds.languageProvider.fetchLabelsWithMatch(matcher);
      labelOptions = this.processLabelOptions(
        Object.entries(response).map(([key, value]) => ({
          value: key,
          text: Array.isArray(value) ? value[0] : value || key,
        }))
      );
    } else {
      // the Prometheus series endpoint cannot accept an empty matcher
      // when there are no filters, we cannot send the matcher passed to this function because
      // Prometheus evaluates it as empty and returns an error
      const filters = this.getFiltersFromVariable(sceneObject);
      const response = await ds.getTagKeys(filters);
      labelOptions = this.processLabelOptions(response.map(({ value, text }) => ({ value: text, text })));
    }

    return [{ value: NULL_GROUP_BY_VALUE, text: '(none)' }, ...labelOptions] as MetricFindValue[];
  }

  private processLabelOptions(options: Array<{ value: string; text: string }>): Array<{ value: string; text: string }> {
    return options.filter(({ value }) => !value.startsWith('__')).sort((a, b) => localeCompare(a.value, b.value));
  }

  private getFiltersFromVariable(sceneObject: SceneObject): { filters: any[] } {
    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, sceneObject);

    if (isAdHocFiltersVariable(filtersVariable)) {
      return { filters: filtersVariable.state.filters };
    }

    return { filters: [] };
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

  static async fetchLabelValues(labelName: string, sceneObject: SceneObject): Promise<string[]> {
    const ds = await LabelsDataSource.getPrometheusDataSource(sceneObject);
    if (!ds) {
      return [];
    }

    const filterExpression = sceneGraph.interpolate(sceneObject, VAR_FILTERS_EXPR, {});

    const response = await ds.languageProvider.fetchLabelValues(
      labelName,
      // `{__name__=~".+",$${VAR_FILTERS}}` // FIXME: the filters var is not interpolated, why?!
      `{__name__=~".+",${filterExpression}}`
    );

    return response;
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    return {
      status: 'success',
      message: 'OK',
    };
  }
}
