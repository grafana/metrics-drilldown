import { PluginType, type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import { type DataSourceRef, type DataSourceSrv } from '@grafana/runtime';

export const mockDataSource: DataSourceApi = {
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

export function createMockDataSource(settings: Partial<DataSourceInstanceSettings> = {}): DataSourceInstanceSettings {
  return {
    id: settings.id || mockDataSource.id,
    uid: settings.uid || mockDataSource.uid,
    type: settings.type || mockDataSource.type,
    name: settings.name || mockDataSource.name,
    access: settings.access || 'proxy',
    readOnly: settings.readOnly || false,
    meta: settings.meta || mockDataSource.meta,
    jsonData: {},
    ...settings,
  };
}

class MockDataSource implements DataSourceApi {
  name: string;
  type: string;
  id: number;
  uid: string;
  meta: any;

  constructor(settings: Partial<DataSourceApi> = {}) {
    this.name = settings.name || 'Prometheus';
    this.type = settings.type || 'prometheus';
    this.id = settings.id || 1;
    this.uid = settings.uid || 'ds';
    this.meta = settings.meta || mockDataSource.meta;
  }

  query() {
    return Promise.resolve({ data: [] });
  }

  testDatasource() {
    return Promise.resolve({ status: 'success', message: 'Success' });
  }

  getRef() {
    return { type: this.type, uid: this.uid };
  }
}

export function createMockDataSourceApi(settings: Partial<DataSourceApi> = {}): DataSourceApi {
  return new MockDataSource(settings);
}

export class MockDataSourceSrv implements DataSourceSrv {
  private datasources: Record<string, DataSourceApi> = {};

  constructor(datasources: Record<string, Partial<DataSourceApi>>) {
    this.datasources = Object.entries(datasources).reduce((acc, [key, ds]) => {
      const mockDs = createMockDataSourceApi(ds);
      // Store by UID if available, otherwise by key
      const storageKey = ds.uid || key;
      acc[storageKey] = mockDs;
      return acc;
    }, {} as Record<string, DataSourceApi>);
  }

  async get(ref?: DataSourceRef | string | null, scopedVars?: any): Promise<DataSourceApi> {
    if (!ref) {
      return Object.values(this.datasources)[0];
    }
    
    // Handle DataSourceRef objects
    let uid = typeof ref === 'string' ? ref : ref.uid;
    
    // Handle template literals like '${ds}' with scoped variables
    if (typeof uid === 'string' && uid.startsWith('${') && uid.endsWith('}') && scopedVars) {
      if (scopedVars.__sceneObject && scopedVars.__sceneObject.value) {
        // This is a scene interpolation - return the first datasource
        return Object.values(this.datasources)[0];
      }
    }
    
    if (!uid) {
      return Object.values(this.datasources)[0];
    }
    
    const ds = this.datasources[uid];
    if (!ds) {
      throw new Error(`Data source ${uid} not found`);
    }
    return ds;
  }

  getInstanceSettings(name?: string | null): DataSourceInstanceSettings | undefined {
    const ds = this.datasources[name || ''];
    if (!ds) {
      return undefined;
    }
    return createMockDataSource({
      name: ds.name,
      type: ds.type,
    });
  }

  getList(): DataSourceInstanceSettings[] {
    return Object.values(this.datasources).map((ds) => {
      return createMockDataSource({
        name: ds.name,
        type: ds.type,
      });
    });
  }

  reload() {
    return Promise.resolve();
  }

  registerRuntimeDataSource(): void {
    // No-op implementation for mock
  }
}

export enum DataSourceType {
  Alertmanager = 'alertmanager',
  Loki = 'loki',
  Prometheus = 'prometheus',
}
