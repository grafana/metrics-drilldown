import { PluginType, type DataSourceApi } from '@grafana/data';

export const dataSourceStub: DataSourceApi = {
  name: 'Prometheus',
  type: 'prometheus',
  id: 1,
  uid: 'ds',
  meta: {
    id: 'prometheus',
    name: 'Prometheus',
    type: PluginType.datasource,
    info: {
      version: '',
      logos: { small: '', large: '' },
      updated: '',
      author: { name: '' },
      description: '',
      links: [],
      screenshots: [],
    },
    module: '',
    baseUrl: '',
  },
  query: () => Promise.resolve({ data: [] }),
  testDatasource: () => Promise.resolve({ status: 'success', message: 'Success' }),
  getRef: () => ({ type: 'prometheus', uid: 'ds' }),
};
