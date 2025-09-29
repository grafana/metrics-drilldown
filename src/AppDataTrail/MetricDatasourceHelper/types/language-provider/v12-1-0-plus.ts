import { type PrometheusDatasource } from '@grafana/prometheus';

import { type PrometheusRuntimeDatasource } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';

export function isPrometheusDatasourceV12_1_0Plus(ds: PrometheusRuntimeDatasource): ds is PrometheusDatasource {
  return typeof (ds.languageProvider as PrometheusDatasource['languageProvider']).queryLabelKeys === 'function';
}
