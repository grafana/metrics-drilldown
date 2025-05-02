import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { type PrometheusDatasource } from '@grafana/prometheus';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';

export type DataSource = DataSourceInstanceSettings<DataSourceJsonData>;

/**
 * Helper function to determine if a datasource is a Prometheus datasource
 */
export function isPrometheusDataSource(input: unknown): input is PrometheusDatasource {
  return (
    typeof input === 'object' &&
    input !== null &&
    'type' in input &&
    input.type === 'prometheus' &&
    'uid' in input &&
    typeof input.uid === 'string'
  );
}

export async function findHealthyDataSources(type: 'prometheus' | 'loki', verbose = false) {
  const allDataSourcesOfType = getDataSourceSrv().getList({
    logs: true,
    type,
    filter: (ds) => ds.uid !== 'grafana',
  });
  const healthyDataSources: DataSource[] = [];
  const unhealthyDataSources: DataSource[] = [];

  await Promise.all(
    allDataSourcesOfType.map((ds) =>
      getBackendSrv()
        .get(`/api/datasources/uid/${ds.uid}/health`, undefined, undefined, {
          showSuccessAlert: false,
          showErrorAlert: false,
        })
        .then((health) => (health?.status === 'OK' ? healthyDataSources.push(ds) : unhealthyDataSources.push(ds)))
        .catch(() => unhealthyDataSources.push(ds))
    )
  );

  if (verbose && unhealthyDataSources.length) {
    // Why not use `logger.warn` here? While this information might be useful for observant users
    // who open DevTools, it's not an actionable insight for Grafana Metrics Drilldown developers.
    console.warn(
      `Found ${unhealthyDataSources.length} unhealthy ${type} data sources: ${unhealthyDataSources
        .map((ds) => ds.name)
        .join(', ')}`
    );
  }

  return healthyDataSources;
}
