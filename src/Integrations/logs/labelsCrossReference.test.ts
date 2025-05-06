import { type AdHocVariableFilter } from '@grafana/data';
import { sceneGraph, type AdHocFiltersVariable } from '@grafana/scenes';

import { DataSourceFetcher } from 'utils/utils.datasource';

import { createLabelsCrossReferenceConnector } from './labelsCrossReference';
import { type RelatedLogsScene } from '../../RelatedLogs/RelatedLogsScene';
import { VAR_FILTERS } from '../../shared';

const getListSpy = jest.fn();
const getSpy = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: getListSpy,
    get: getSpy,
  }),
  getTemplateSrv: () => ({
    getAdhocFilters: jest.fn(),
  }),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue({ status: 'OK' }), // Mock successful health checks
  }),
}));

jest.mock('../../utils', () => {
  const actualModule = jest.requireActual('../../utils');
  return {
    ...actualModule,
    getTrailFor: jest.fn(actualModule.getTrailFor),
  };
});

function buildConnector(filters: AdHocVariableFilter[] | null) {
  const mockScene = {
    state: {},
    useState: jest.fn(),
  } as unknown as RelatedLogsScene;

  const connector = createLabelsCrossReferenceConnector(mockScene, dataSourceFetcher);

  jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(
    filters
      ? ({
          __typename: 'AdHocFiltersVariable',
          state: {
            name: VAR_FILTERS,
            type: 'adhoc',
            filters,
          },
        } as unknown as AdHocFiltersVariable)
      : null
  );

  return connector;
}

function buildDataSources() {
  // Create multiple mock Loki datasources with different behaviors
  const ds1 = {
    uid: 'loki1',
    name: 'Loki Production',
    getTagKeys: jest.fn(),
    getTagValues: jest.fn(),
  };

  const ds2 = {
    uid: 'loki2',
    name: 'Loki Staging',
    getTagKeys: jest.fn(),
    getTagValues: jest.fn(),
  };

  const ds3 = {
    uid: 'loki3',
    name: 'Loki Development',
    getTagKeys: jest.fn(),
    getTagValues: jest.fn(),
  };

  const datasources = [ds1, ds2, ds3];

  getListSpy.mockReturnValue(datasources);

  getSpy.mockImplementation(async (uid: string) => {
    const ds = datasources.find((ds) => ds.uid === uid);
    if (!ds) {
      throw new Error(`Datasource with uid ${uid} not found`);
    }
    return ds;
  });

  return datasources;
}

const dataSourceFetcher = new DataSourceFetcher();

describe('LabelsCrossReferenceConnector', () => {
  const basicFilters: AdHocVariableFilter[] = [
    { key: 'environment', operator: '=', value: 'production' },
    { key: 'app', operator: '=', value: 'frontend' },
  ];

  describe('getDataSources', () => {
    it('should find multiple Loki data sources with matching labels', async () => {
      const [ds1, ds2, ds3] = buildDataSources();

      // DS1: Has all required labels and values
      ds1.getTagKeys.mockResolvedValue([{ text: 'environment' }, { text: 'app' }]);
      ds1.getTagValues.mockResolvedValue([{ text: 'production' }, { text: 'frontend' }]);

      // DS2: Has labels but missing values
      ds2.getTagKeys.mockResolvedValue([{ text: 'environment' }, { text: 'app' }]);
      ds2.getTagValues.mockResolvedValue([
        { text: 'staging' }, // Different value
        { text: 'frontend' },
      ]);

      // DS3: Has all required labels and values
      ds3.getTagKeys.mockResolvedValue([{ text: 'environment' }, { text: 'app' }]);
      ds3.getTagValues.mockResolvedValue([{ text: 'production' }, { text: 'frontend' }]);

      const result = await buildConnector(basicFilters).getDataSources();

      expect(result).toStrictEqual([
        { uid: 'loki1', name: 'Loki Production' },
        { uid: 'loki3', name: 'Loki Development' },
      ]);

      // Verify that getTagKeys was called for all datasources
      expect(ds1.getTagKeys).toHaveBeenCalled();
      expect(ds1.getTagKeys).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            { key: 'environment', operator: '=', value: 'production' },
            { key: 'app', operator: '=', value: 'frontend' },
          ]),
        })
      );

      expect(ds2.getTagKeys).toHaveBeenCalled();
      expect(ds3.getTagKeys).toHaveBeenCalled();
    });

    it('should handle mixed availability of label keys across datasources', async () => {
      const [ds1, ds2, ds3] = buildDataSources();

      // DS1: Has all required labels
      ds1.getTagKeys.mockResolvedValue([{ text: 'environment' }, { text: 'app' }]);
      ds1.getTagValues.mockResolvedValue([{ text: 'production' }, { text: 'frontend' }]);

      // DS2: Missing some required labels
      ds2.getTagKeys.mockResolvedValue([
        { text: 'environment' }, // missing 'app'
      ]);

      // DS3: Has different set of labels
      ds3.getTagKeys.mockResolvedValue([{ text: 'region' }, { text: 'cluster' }]);

      const result = await buildConnector(basicFilters).getDataSources();

      expect(result).toStrictEqual([{ uid: 'loki1', name: 'Loki Production' }]);

      // DS2 and DS3 should not have getTagValues called since they don't have all required labels
      expect(ds1.getTagValues).toHaveBeenCalled();
      expect(ds2.getTagValues).not.toHaveBeenCalled();
      expect(ds3.getTagValues).not.toHaveBeenCalled();
    });

    it('should handle known label name discrepancies across multiple datasources', async () => {
      const [ds1, ds2, ds3] = buildDataSources();

      // DS1: Has matching labels with known discrepancies
      ds1.getTagKeys.mockResolvedValue([{ text: 'service_name' }, { text: 'service_instance_id' }]);
      ds1.getTagValues.mockResolvedValue([{ text: 'grafana' }, { text: 'instance1' }]);

      // DS2: Also has transformed label names
      ds2.getTagKeys.mockResolvedValue([{ text: 'service_name' }, { text: 'service_instance_id' }]);
      ds2.getTagValues.mockResolvedValue([{ text: 'grafana' }, { text: 'instance1' }]);

      // DS3: Missing required labels
      ds3.getTagKeys.mockResolvedValue([
        { text: 'service_name' }, // missing service_instance_id
      ]);

      const filtersWithKnownLabels: AdHocVariableFilter[] = [
        { key: 'job', operator: '=', value: 'grafana' },
        { key: 'instance', operator: '=', value: 'instance1' },
      ];
      const result = await buildConnector(filtersWithKnownLabels).getDataSources();

      expect(result).toStrictEqual([
        { uid: 'loki1', name: 'Loki Production' },
        { uid: 'loki2', name: 'Loki Staging' },
      ]);

      // Verify that label name mapping was applied correctly
      expect(ds1.getTagKeys).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({ key: 'service_name' }),
            expect.objectContaining({ key: 'service_instance_id' }),
          ]),
        })
      );
    });
  });

  // Rest of the tests remain the same...
  describe('getLokiQueryExpr', () => {
    it('should generate correct Loki query expression from filters', () => {
      const result = buildConnector(basicFilters).getLokiQueryExpr();

      expect(result).toBe('{environment="production",app="frontend"}');
    });

    it('should handle conversion of known label names', () => {
      const filtersWithKnownLabels: AdHocVariableFilter[] = [
        { key: 'job', operator: '=', value: 'grafana' },
        { key: 'instance', operator: '=', value: 'instance1' },
      ];

      const result = buildConnector(filtersWithKnownLabels).getLokiQueryExpr();

      expect(result).toBe('{service_name="grafana",service_instance_id="instance1"}');
    });

    it('should return empty string when no filters are present', () => {
      const result = buildConnector([]).getLokiQueryExpr();

      expect(result).toBe('');
    });

    it('should handle missing filters variable', () => {
      const result = buildConnector(null).getLokiQueryExpr();

      expect(result).toBe('');
    });

    it('should handle different filter operators', () => {
      const filtersWithOperators: AdHocVariableFilter[] = [
        { key: 'environment', operator: '!=', value: 'dev' },
        { key: 'level', operator: '=~', value: 'error|warn' },
      ];

      const result = buildConnector(filtersWithOperators).getLokiQueryExpr();

      expect(result).toBe('{environment!="dev",level=~"error|warn"}');
    });
  });
});
