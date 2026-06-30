import {
  FieldType,
  LoadingState,
  type DataQueryResponse,
  type LegacyMetricFindQueryOptions,
  type MetricFindValue,
  type TestDataSourceResponse,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { RuntimeDataSource, sceneGraph, type SceneObject } from '@grafana/scenes';

import { MetricDatasourceHelper } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { discoverBreakdownLabels } from 'shared/utils/discoverBreakdownLabels';
import { parseBinaryQuery } from 'shared/utils/parseBinaryQuery';
import { getTrailFor } from 'shared/utils/utils';

/**
 * Runtime datasource that returns the group-by label options for a binary (ratio) insight.
 *
 * Mirrors `LabelsDataSource`: a `QueryVariable` points at this uid and `metricFindQuery` returns the
 * options. The binary query string is the KG-supplied insight query carried on `trail.state.query`
 * (not the variable query), parsed with `parseBinaryQuery`, and turned into labels via
 * `discoverBreakdownLabels` (per-operand `fetchLabels` + intersection). Returns [] when the trail
 * query is absent or not a clean binary, so the caller's single-metric `label_names` path stays in charge.
 */
export class BinaryRatioLabelsDataSource extends RuntimeDataSource {
  static readonly uid = 'grafana-metricsdrilldown-binary-ratio-labels';

  constructor() {
    super(BinaryRatioLabelsDataSource.uid, BinaryRatioLabelsDataSource.uid);
  }

  async query(): Promise<DataQueryResponse> {
    return {
      state: LoadingState.Done,
      data: [{ name: 'BinaryRatioLabels', fields: [{ name: null, type: FieldType.other, values: [], config: {} }], length: 0 }],
    };
  }

  async metricFindQuery(_query: string, options: LegacyMetricFindQueryOptions): Promise<MetricFindValue[]> {
    const sceneObject = options.scopedVars?.__sceneObject?.valueOf() as SceneObject | undefined;
    if (!sceneObject) {
      return [];
    }

    const trail = getTrailFor(sceneObject);
    const query = trail.state.query;
    if (!query) {
      return [];
    }

    const ratio = parseBinaryQuery(query);
    if (!ratio) {
      return [];
    }

    const ds = await MetricDatasourceHelper.getPrometheusDataSourceForScene(sceneObject);
    if (!ds) {
      return [];
    }

    const labels = await discoverBreakdownLabels({
      ratio,
      ds,
      timeRange: sceneGraph.getTimeRange(sceneObject).state.value,
    });

    return labels.map((label) => ({ value: label, text: label }));
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    return { status: 'success', message: t('binary-ratio-labels-datasource.test-success', 'OK') };
  }
}
