/* eslint-disable sonarjs/no-nested-functions */
import { setDataSourceSrv } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

import { MetricsVariable, VAR_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

import { DataTrail } from '../DataTrail';
import { MetricDatasourceHelper } from './MetricDatasourceHelper';
import { DataSourceType, MockDataSourceSrv } from '../test/mocks/datasource';

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

  await metricDatasourceHelper.init();

  return {
    metricsVariable,
    runtimeDatasource,
    metricDatasourceHelper,
  };
}

describe('MetricDatasourceHelper', () => {
  describe('isNativeHistogram(metric)', () => {
    test('returns false if metric is a classic histogram', async () => {
      const { metricDatasourceHelper } = await setup();

      const result = await metricDatasourceHelper.isNativeHistogram('classic_histogram_metric_bucket');

      expect(result).toBe(false);
    });

    describe('if metric is not a classic histogram', () => {
      test('returns true if the type in its metadata is "histogram"', async () => {
        const { runtimeDatasource, metricDatasourceHelper } = await setup();

        runtimeDatasource.languageProvider.queryMetricsMetadata.mockResolvedValue({
          native_histogram: { type: 'histogram' },
        });

        const result = await metricDatasourceHelper.isNativeHistogram('native_histogram');

        expect(result).toBe(true);
      });

      describe('if its type is not "histogram"', () => {
        test('returns false if it does NOT have a classic histogram to compare to', async () => {
          const { metricsVariable, metricDatasourceHelper } = await setup();

          metricsVariable.setState({
            options: [
              {
                value: 'classic_histogram_to_compare_to_metric_bucket',
                label: 'classic_histogram_to_compare_to_metric_bucket',
              },
            ],
          });

          const result = await metricDatasourceHelper.isNativeHistogram('non_classic_histogram_to_compare_to_metric');

          expect(result).toBe(false);
        });

        test('returns true if it does have a classic histogram to compare to', async () => {
          const { metricsVariable, metricDatasourceHelper } = await setup();

          metricsVariable.setState({
            options: [
              {
                value: 'classic_histogram_to_compare_to_metric_bucket',
                label: 'classic_histogram_to_compare_to_metric_bucket',
              },
            ],
          });

          const result = await metricDatasourceHelper.isNativeHistogram('classic_histogram_to_compare_to_metric');

          expect(result).toBe(true);
        });
      });
    });
  });
});
