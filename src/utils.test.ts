import { AdHocFiltersVariable } from '@grafana/scenes';

import { type DataTrail } from './DataTrail';
import { type MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { limitAdhocProviders } from './utils';

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

describe('limitAdhocProviders', () => {
  let filtersVariable: AdHocFiltersVariable;
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

    datasourceHelper = {
      getTagKeys: jest.fn().mockResolvedValue(Array(20000).fill({ text: 'key' })),
      getTagValues: jest.fn().mockResolvedValue(Array(20000).fill({ text: 'value' })),
    } as unknown as MetricDatasourceHelper;

    dataTrail = {
      getQueries: jest.fn().mockReturnValue([]),
    } as unknown as DataTrail;
  });

  describe('getTagKeysProvider', () => {
    it('should limit the number of tag keys returned in the variable to 10000', async () => {
      limitAdhocProviders(dataTrail, filtersVariable, datasourceHelper);

      const result = await filtersVariable.state!.getTagKeysProvider!(filtersVariable, null);

      expect(result.values).toHaveLength(10000);
      expect(result.replace).toBe(true);
    });

    it.each([
      [true, ['query1', 'query2']],
      [false, []],
    ])(
      'should respect the AdHocFiltersVariable "useQueriesAsFilterForOptions" option (%s)',
      async (useQueriesAsFilterForOptions, expectedQueries) => {
        (dataTrail.getQueries as jest.Mock).mockReturnValue(['query1', 'query2']);
        filtersVariable.setState({ useQueriesAsFilterForOptions });

        limitAdhocProviders(dataTrail, filtersVariable, datasourceHelper);

        await filtersVariable.state!.getTagKeysProvider!(filtersVariable, null);

        expect(datasourceHelper.getTagKeys).toHaveBeenCalledWith({
          filters: [],
          scopes: [],
          queries: expectedQueries,
        });
      }
    );
  });

  describe('getTagValuesProvider', () => {
    const filter = {
      key: 'testKey',
      operator: '=',
      value: 'testValue',
    } as const;

    it('should limit the number of tag values returned in the variable to 10000', async () => {
      limitAdhocProviders(dataTrail, filtersVariable, datasourceHelper);

      const result = await filtersVariable.state!.getTagValuesProvider!(filtersVariable, filter);

      expect(result.values).toHaveLength(10000);
      expect(result.replace).toBe(true);
    });

    it.each([
      [true, ['query1', 'query2']],
      [false, []],
    ])(
      'should respect the AdHocFiltersVariable "useQueriesAsFilterForOptions" option (%s)',
      async (useQueriesAsFilterForOptions, expectedQueries) => {
        (dataTrail.getQueries as jest.Mock).mockReturnValue(['query1', 'query2']);
        filtersVariable.setState({ useQueriesAsFilterForOptions });

        limitAdhocProviders(dataTrail, filtersVariable, datasourceHelper);

        await filtersVariable.state!.getTagValuesProvider!(filtersVariable, filter);

        expect(datasourceHelper.getTagValues).toHaveBeenCalledWith({
          key: filter.key,
          filters: [],
          scopes: [],
          queries: expectedQueries,
        });
      }
    );
  });
});
