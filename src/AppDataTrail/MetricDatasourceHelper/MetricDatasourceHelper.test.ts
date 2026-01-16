 
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
});
