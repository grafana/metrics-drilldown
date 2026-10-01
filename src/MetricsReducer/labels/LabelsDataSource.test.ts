import { VariableRefresh } from '@grafana/data';
import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { MetricDatasourceHelper } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';

import { buildLabelValuesQuery, LabelsDataSource } from './LabelsDataSource';
import { LabelValuesVariable } from './LabelValuesVariable';

const timeRange = { from: 'now-7d', to: 'now', raw: { from: 'now-7d', to: 'now' } } as any;
const sceneObject = {} as SceneObject;
const options = {
  scopedVars: {
    __sceneObject: {
      valueOf: () => sceneObject,
    },
  },
} as any;

describe('LabelsDataSource label-value queries', () => {
  beforeEach(() => {
    jest.spyOn(MetricDatasourceHelper, 'getPrometheusDataSourceForScene').mockResolvedValue({} as any);
    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({ state: { value: timeRange } } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('interpolates and forwards an optional metric matcher with the selected time range', async () => {
    const fetchLabelValues = jest
      .spyOn(MetricDatasourceHelper, 'fetchLabelValues')
      .mockResolvedValue(['', 'api-1', 'api-2']);
    jest.spyOn(sceneGraph, 'interpolate').mockReturnValue('test_metric{job="api",region=~"us-.+"}');

    const datasource = new LabelsDataSource();
    const result = await datasource.metricFindQuery(
      buildLabelValuesQuery('instance', 'test_metric{${filters:raw}}'),
      options
    );

    expect(sceneGraph.interpolate).toHaveBeenCalledWith(sceneObject, 'test_metric{${filters:raw}}');
    expect(fetchLabelValues).toHaveBeenCalledWith({
      ds: expect.anything(),
      labelName: 'instance',
      timeRange,
      matcher: 'test_metric{job="api",region=~"us-.+"}',
    });
    expect(result).toEqual([
      { value: '', text: '' },
      { value: 'api-1', text: 'api-1' },
      { value: 'api-2', text: 'api-2' },
    ]);
  });

  it('keeps the original unscoped valuesOf query behavior', async () => {
    const fetchLabelValues = jest.spyOn(MetricDatasourceHelper, 'fetchLabelValues').mockResolvedValue(['api']);

    const datasource = new LabelsDataSource();
    await datasource.metricFindQuery('valuesOf(job)', options);

    expect(fetchLabelValues).toHaveBeenCalledWith({
      ds: expect.anything(),
      labelName: 'job',
      timeRange,
      matcher: undefined,
    });
  });

  it('returns an empty option list when the label-values request fails', async () => {
    jest.spyOn(MetricDatasourceHelper, 'fetchLabelValues').mockRejectedValue(new Error('request failed'));

    const datasource = new LabelsDataSource();

    await expect(datasource.metricFindQuery(buildLabelValuesQuery('job', 'test_metric{}'), options)).resolves.toEqual(
      []
    );
  });

  it('does not query Prometheus for an empty label name', async () => {
    const fetchLabelValues = jest.spyOn(MetricDatasourceHelper, 'fetchLabelValues');
    const datasource = new LabelsDataSource();

    await expect(datasource.metricFindQuery(buildLabelValuesQuery('', 'test_metric{}'), options)).resolves.toEqual([]);

    expect(MetricDatasourceHelper.getPrometheusDataSourceForScene).not.toHaveBeenCalled();
    expect(fetchLabelValues).not.toHaveBeenCalled();
  });

  it('stores the matcher in LabelValuesVariable while retaining time-range refresh', () => {
    const variable = new LabelValuesVariable({
      labelName: '"service.name"',
      matcher: '{"🔥 metric", ${filters:raw}}',
    });

    expect(variable.state.query).toBe('labelValues:%22service.name%22\n{"🔥 metric", ${filters:raw}}');
    expect(variable.state.refresh).toBe(VariableRefresh.onTimeRangeChanged);
  });
});
