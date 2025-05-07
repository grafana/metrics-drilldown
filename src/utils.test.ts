import { AdHocFiltersVariable, SceneObjectRef } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { type MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { sortResources } from './otel/util';
import { VAR_OTEL_AND_METRIC_FILTERS } from './shared';
import { getTrailStore } from './TrailStore/TrailStore';
import { getDatasourceForNewTrail, limitAdhocProviders } from './utils';
import { isAdHocFiltersVariable } from './utils/utils.variables';

jest.mock('./TrailStore/TrailStore', () => ({
  getTrailStore: jest.fn(),
}));

const getListSpy = jest.fn();
const fetchSpy = jest.fn();

// Mock the entire @grafana/runtime module
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: getListSpy,
    get: jest.fn(),
    getInstanceSettings: jest.fn(),
    reload: jest.fn(),
  }),
  getBackendSrv: () => ({
    fetch: fetchSpy,
    delete: jest.fn(),
    get: jest.fn().mockResolvedValue({ status: 'OK' }), // Mock successful health checks
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    request: jest.fn(),
    datasourceRequest: jest.fn(),
  }),
}));

jest.mock('./otel/util', () => ({
  sortResources: jest.fn(),
}));

describe('limitAdhocProviders', () => {
  let filtersVariable: AdHocFiltersVariable;
  let otelAndMetricsVariable: AdHocFiltersVariable;
  let datasourceHelper: MetricDatasourceHelper;
  let dataTrail: DataTrail;

  beforeEach(() => {
    // disable console.log called in Scenes for this test
    // called in scenes/packages/scenes/src/variables/adhoc/patchGetAdhocFilters.ts
    jest.spyOn(console, 'log').mockImplementation(jest.fn());

    filtersVariable = new AdHocFiltersVariable({
      name: 'testVariable',
      label: 'Test Variable',
      type: 'adhoc',
    });

    otelAndMetricsVariable = new AdHocFiltersVariable({
      name: VAR_OTEL_AND_METRIC_FILTERS,
      label: 'Test Variable',
      type: 'adhoc',
    });

    datasourceHelper = {
      getTagKeys: jest.fn().mockResolvedValue(Array(20000).fill({ text: 'key' })),
      getTagValues: jest.fn().mockResolvedValue(Array(20000).fill({ text: 'value' })),
    } as unknown as MetricDatasourceHelper;

    dataTrail = {
      getQueries: jest.fn().mockReturnValue([]),
    } as unknown as DataTrail;
  });

  it('should limit the number of tag keys returned in the variable to 10000', async () => {
    limitAdhocProviders(dataTrail, filtersVariable, datasourceHelper);

    const result = await filtersVariable.state!.getTagKeysProvider!(filtersVariable, null);

    expect(result.values).toHaveLength(10000);
    expect(result.replace).toBe(true);
  });

  it('should limit the number of tag values returned in the variable to 10000', async () => {
    limitAdhocProviders(dataTrail, filtersVariable, datasourceHelper);

    const result = await filtersVariable.state!.getTagValuesProvider!(filtersVariable, {
      key: 'testKey',
      operator: '=',
      value: 'testValue',
    });

    expect(result.values).toHaveLength(10000);
    expect(result.replace).toBe(true);
  });

  it('should call sort resources and sort the promoted otel resources list if using the otel and metrics filter', async () => {
    limitAdhocProviders(dataTrail, otelAndMetricsVariable, datasourceHelper);
    if (isAdHocFiltersVariable(otelAndMetricsVariable) && otelAndMetricsVariable.state.getTagKeysProvider) {
      await otelAndMetricsVariable.state.getTagKeysProvider(otelAndMetricsVariable, null);
    }
    expect(sortResources).toHaveBeenCalled();
  });
});

describe('getDatasourceForNewTrail', () => {
  beforeEach(() => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [],
    }));
    getListSpy.mockReturnValue([
      { uid: 'prom1', isDefault: true },
      { uid: 'prom2', isDefault: false },
    ]);
  });

  it('should return the most recent exploration data source', () => {
    const trail = new DataTrail({ key: '1', metric: 'select me', initialDS: 'prom2' });
    const trailWithResolveMethod = new SceneObjectRef(trail);
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [trailWithResolveMethod],
    }));
    const result = getDatasourceForNewTrail();
    expect(result).toBe('prom2');
  });

  it('should return the default Prometheus data source if no previous exploration exists', () => {
    const result = getDatasourceForNewTrail();
    expect(result).toBe('prom1');
  });

  it('should return the most recently added Prom data source if no default exists and no recent exploration', () => {
    getListSpy.mockReturnValue([
      { uid: 'newProm', isDefault: false },
      { uid: 'prom1', isDefault: false },
      { uid: 'prom2', isDefault: false },
    ]);
    const result = getDatasourceForNewTrail();
    expect(result).toBe('newProm');
  });
});
