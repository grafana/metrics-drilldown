import { config } from '@grafana/runtime';

import { isPrometheusDataSource } from 'utils/utils.datasource';

export function useListPrometheusDataSources() {
  const datasources = Object.values(config.datasources).filter(isPrometheusDataSource);
  return { datasources };
}
