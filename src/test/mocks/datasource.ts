import { VariableSupportType, type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import { type DataSourceSrv } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

import { dataSourceStub } from '../stubs/dataSourceStub';

export function createMockDataSource(settings: Partial<DataSourceInstanceSettings> = {}): DataSourceInstanceSettings {
  return {
    id: settings.id || dataSourceStub.id,
    uid: settings.uid || dataSourceStub.uid,
    type: settings.type || dataSourceStub.type,
    name: settings.name || dataSourceStub.name,
    access: settings.access || 'proxy',
    readOnly: settings.readOnly || false,
    meta: settings.meta || dataSourceStub.meta,
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
  languageProvider: any;
  variables: any;

  constructor(settings: Partial<DataSourceApi> = {}) {
    this.name = settings.name || 'Prometheus';
    this.type = settings.type || 'prometheus';
    this.id = settings.id || 1;
    this.uid = settings.uid || 'ds';
    this.meta = settings.meta || dataSourceStub.meta;
    this.languageProvider = {
      queryMetricsMetadata: jest.fn(async () => ({})),
      queryLabelKeys: jest.fn(async () => []),
      // eslint-disable-next-line no-unused-vars
      fetchLabelValues: jest.fn(async (_: any) => []),
      request: jest.fn(async () => ({})),
    };
    this.variables = {
      getType: () => VariableSupportType.Datasource,
    };
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
