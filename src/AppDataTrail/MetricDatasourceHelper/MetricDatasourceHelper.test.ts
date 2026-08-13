import { setDataSourceSrv } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

import { DataTrail } from 'AppDataTrail/DataTrail';
import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';

import { MetricDatasourceHelper } from './MetricDatasourceHelper';
import { DataSourceType, MockDataSourceSrv } from '../../test/mocks/datasource';

async function setup() {
  const dataSourceSrv = new MockDataSourceSrv({
    prom: {
      name: 'Prometheus',
      type: DataSourceType.Prometheus,
      uid: 'ds',
    },
  });
  setDataSourceSrv(dataSourceSrv);
  const runtimeDatasource = await dataSourceSrv.get();

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
