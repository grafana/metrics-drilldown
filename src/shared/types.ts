import { type getDataSourceInstanceList } from '@grafana/plugin-compat/datasources';

// replace with proper types from @grafana/data >= 13.2 instead
export type DataSourceInstances = Awaited<ReturnType<typeof getDataSourceInstanceList>>;
export type DataSourceInstance = DataSourceInstances[number];
