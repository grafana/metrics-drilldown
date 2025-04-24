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
import { type PrometheusDatasource } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { RuntimeDataSource, sceneGraph, type DataSourceVariable, type SceneObject } from '@grafana/scenes';

import { VAR_DATASOURCE, VAR_FILTERS, VAR_FILTERS_EXPR } from 'shared';
import { isAdHocFiltersVariable } from 'utils/utils.variables';
import { displayError, displayWarning } from 'WingmanDataTrail/helpers/displayStatus';

import { localeCompare } from '../helpers/localCompare';

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

    let labelOptions: MetricFindValue[] = [];

    try {
      labelOptions = await this.fetchLabels(ds, sceneObject, matcher);
    } catch (error) {
      displayWarning(['Error while fetching labels! Defaulting to an empty array.', (error as Error).toString()]);
    }

    return [{ value: NULL_GROUP_BY_VALUE, text: '(none)' }, ...labelOptions] as MetricFindValue[];
  }

  private static async getPrometheusDataSource(sceneObject: SceneObject): Promise<DataSourceApi | undefined> {
    try {
      const dsVariable = sceneGraph.findByKey(sceneObject, VAR_DATASOURCE) as DataSourceVariable;
      const uid = (dsVariable?.state.value as string) ?? '';
      return await getDataSourceSrv().get({ uid });
    } catch (error) {
      displayError(error as Error, ['Error while getting the Prometheus data source!']);
      return undefined;
    }
  }

  private async fetchLabels(ds: PrometheusDatasource, sceneObject: SceneObject, matcher: string) {
    // there is probably a more graceful way to implement this, but this is what the DS offers us.
    // if a DS does not support the labels match API, we need getTagKeys to handle the empty matcher
    if (!LabelsDataSource.getLabelsMatchAPISupport(ds)) {
      // the Prometheus series endpoint cannot accept an empty matcher
      // when there are no filters, we cannot send the matcher passed to this function because Prometheus evaluates it as empty and returns an error
      const filters = LabelsDataSource.getFiltersFromVariable(sceneObject);
      const response = await ds.getTagKeys(filters);

      return this.processLabelOptions(
        response.map(({ text }) => ({
          value: text,
          text,
        }))
      );
    }

    const args =
      ds.languageProvider.fetchLabelsWithMatch.length === 2
        ? [matcher]
        : [sceneGraph.getTimeRange(sceneObject).state.value, matcher];

    // @ts-ignore: Ignoring type error due to breaking change in fetchLabelValues signature
    const response = await ds.languageProvider.fetchLabelsWithMatch(...args);

    return this.processLabelOptions(
      Object.entries(response).map(([key, value]) => ({
        value: key,
        text: Array.isArray(value) ? value[0] : value || key,
      }))
    );
  }

  private static getLabelsMatchAPISupport(ds: PrometheusDatasource) {
    try {
      return ds.hasLabelsMatchAPISupport();
    } catch (error) {
      displayWarning([
        'Error while checking if the current data source supports the labels match API! Defaulting to false.',
        (error as Error).toString(),
      ]);
      return false;
    }
  }

  private static getFiltersFromVariable(sceneObject: SceneObject): { filters: any[] } {
    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, sceneObject);

    if (isAdHocFiltersVariable(filtersVariable)) {
      return { filters: filtersVariable.state.filters };
    }

    return { filters: [] };
  }

  private processLabelOptions(options: Array<{ value: string; text: string }>): Array<{ value: string; text: string }> {
    return options.filter(({ value }) => !value.startsWith('__')).sort((a, b) => localeCompare(a.value, b.value));
  }

  static async fetchLabelValues(labelName: string, sceneObject: SceneObject): Promise<string[]> {
    const ds = await LabelsDataSource.getPrometheusDataSource(sceneObject);
    if (!ds) {
      return [];
    }

    const filterExpression = sceneGraph.interpolate(sceneObject, VAR_FILTERS_EXPR, {});

    const args =
      ds.languageProvider.fetchLabelValues.length === 2
        ? // new signature for fetchLabelValues includes time range
          [
            sceneGraph.getTimeRange(sceneObject).state.value,
            labelName,
            // `{__name__=~".+",$${VAR_FILTERS}}` // FIXME: the filters var is not interpolated, why?!
            `{__name__=~".+",${filterExpression}}`,
          ]
        : // handle old signature for backwards compatibility
          [labelName, `{__name__=~".+",${filterExpression}}`];

    try {
      return await ds.languageProvider.fetchLabelValues(...args);
    } catch (error) {
      displayWarning([
        `Error while retrieving label "${labelName}" values! Defaulting to an empty array.`,
        (error as Error).toString(),
      ]);
      return [];
    }
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    return {
      status: 'success',
      message: 'OK',
    };
  }
}
