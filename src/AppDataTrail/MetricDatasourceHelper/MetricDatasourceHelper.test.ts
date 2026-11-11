import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { EmbeddedScene, SceneFlexLayout, sceneGraph } from '@grafana/scenes';

import { DataTrail } from 'AppDataTrail/DataTrail';
import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';

import { MetricDatasourceHelper } from './MetricDatasourceHelper';
import { DataSourceType } from '../../test/mocks/datasource';

jest.mock('@grafana/plugin-compat/datasources', () => ({ getDataSourceInstance: jest.fn() }));
const getDataSourceInstanceMock = jest.mocked(getDataSourceInstance);

async function setup() {
  jest.clearAllMocks();

  const runtimeDatasource: any = {
    name: 'Prometheus',
    type: DataSourceType.Prometheus,
    uid: 'ds',
    languageProvider: { request: jest.fn() },
  };
  getDataSourceInstanceMock.mockResolvedValue(runtimeDatasource);

  const trail = new DataTrail({});
  const metricsVariable = sceneGraph.findByKeyAndType(trail, VAR_METRICS_VARIABLE, MetricsVariable);
  const metricDatasourceHelper = new MetricDatasourceHelper(trail);

  metricDatasourceHelper.init();

  return {
    metricsVariable,
    runtimeDatasource,
    metricDatasourceHelper,
  };
}

describe('MetricDatasourceHelper', () => {
  describe('getMetadataForMetric(metric)', () => {
    test('calls the /metadata API endpoint and returns the expected metadata', async () => {
      const { runtimeDatasource, metricDatasourceHelper } = await setup();

      const metadata = { name: 'native_histogram', type: 'histogram', description: '' };

      runtimeDatasource.languageProvider.request.mockResolvedValue({
        native_histogram: [metadata],
      });

      const result = await metricDatasourceHelper.getMetadataForMetric('native_histogram');

      expect(runtimeDatasource.languageProvider.request).toHaveBeenCalledWith(
        '/api/v1/metadata?metric=native_histogram'
      );

      expect(result).toEqual(metadata);
    });
  });

  describe('standalone scene context', () => {
    test('fetches encoded metric metadata using a plain scene, without a DataTrail', async () => {
      const scene = new EmbeddedScene({ body: new SceneFlexLayout({ children: [] }) });
      const helper = new MetricDatasourceHelper(scene);
      const metric = 'http.server.🔥&metric=other';
      const metadata = { type: 'histogram', help: '', unit: '' };
      const request = jest.fn().mockResolvedValue({ [metric]: [metadata] });
      getDataSourceInstanceMock.mockResolvedValue({
        type: 'prometheus',
        uid: 'standalone',
        languageProvider: { request },
      } as any);

      expect(await helper.getMetadataForMetric(metric)).toEqual(metadata);
      expect(request).toHaveBeenCalledWith(`/api/v1/metadata?metric=${encodeURIComponent(metric)}`);
      expect(getDataSourceInstanceMock).toHaveBeenCalledWith('${ds}', { __sceneObject: { value: scene } });
      expect(await helper.getMetadataForMetric(metric)).toEqual(metadata);
      expect(request).toHaveBeenCalledTimes(1);
    });

    test('datasource lookup failures are inconclusive metadata, not unhandled rejections', async () => {
      const scene = new EmbeddedScene({ body: new SceneFlexLayout({ children: [] }) });
      const helper = new MetricDatasourceHelper(scene);
      getDataSourceInstanceMock.mockRejectedValue(new Error('Datasource unavailable'));
      await expect(helper.getMetadataForMetric('temperature')).resolves.toBeUndefined();
    });

    test('separate scene helpers do not share native histogram probe results', () => {
      const a = new MetricDatasourceHelper(new EmbeddedScene({ body: new SceneFlexLayout({ children: [] }) }));
      const b = new MetricDatasourceHelper(new EmbeddedScene({ body: new SceneFlexLayout({ children: [] }) }));
      a.setCachedNativeHistogram('temperature', true);
      expect(b.getCachedNativeHistogram('temperature')).toBeUndefined();
    });
  });

  describe('native-histogram detection cache', () => {
    test('returns undefined for a metric that has not been probed', async () => {
      const { metricDatasourceHelper } = await setup();

      expect(metricDatasourceHelper.getCachedNativeHistogram('not_probed')).toBeUndefined();
    });

    test('stores and returns the probe result per metric', async () => {
      const { metricDatasourceHelper } = await setup();

      metricDatasourceHelper.setCachedNativeHistogram('a_native_histogram', true);
      metricDatasourceHelper.setCachedNativeHistogram('a_gauge', false);

      expect(metricDatasourceHelper.getCachedNativeHistogram('a_native_histogram')).toBe(true);
      expect(metricDatasourceHelper.getCachedNativeHistogram('a_gauge')).toBe(false);
    });

    test('clears the cache on reset (e.g. datasource change)', async () => {
      const { metricDatasourceHelper } = await setup();

      metricDatasourceHelper.setCachedNativeHistogram('a_native_histogram', true);
      metricDatasourceHelper.reset();

      expect(metricDatasourceHelper.getCachedNativeHistogram('a_native_histogram')).toBeUndefined();
    });
  });
});
