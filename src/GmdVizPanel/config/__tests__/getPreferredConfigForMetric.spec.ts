import { AVAILABLE_PANEL_TYPES } from 'GmdVizPanel/types/available-panel-types';

import { isValid } from '../getPreferredConfigForMetric';
import { CONFIG_PRESETS, type PanelConfigPreset } from '../presets/types';

const createValidConfig = (): PanelConfigPreset => ({
  id: CONFIG_PRESETS.TIMESERIES_AVG,
  name: 'Test Config',
  panelOptions: {
    type: 'timeseries',
  },
  queryOptions: {
    queries: [
      {
        fn: 'avg',
      },
    ],
  },
});

describe('isValid(metricConfig)', () => {
  it('returns true for valid config with all required properties', () => {
    const config = createValidConfig();
    expect(isValid(config)).toBe(true);
  });

  describe('required properties validation', () => {
    it.each(['id', 'panelOptions', 'queryOptions'])('returns false when "%s" is missing', (property) => {
      const config = createValidConfig();
      delete (config as any)[property];
      expect(isValid(config)).toBe(false);
    });
  });

  describe('id validation', () => {
    it.each(Object.values(CONFIG_PRESETS))('returns true for valid preset id: %s', (presetId) => {
      const config = createValidConfig();
      config.id = presetId;
      expect(isValid(config)).toBe(true);
    });

    it('returns false when id is not a valid CONFIG_PRESET value', () => {
      const config = createValidConfig();
      (config.id as any) = 'invalid-preset-id';
      expect(isValid(config)).toBe(false);
    });

    it('returns false when id is not a string', () => {
      const config = createValidConfig();
      (config as any).id = 123;
      expect(isValid(config)).toBe(false);
    });
  });

  describe('panelOptions.type validation', () => {
    it.each(AVAILABLE_PANEL_TYPES)('returns true for valid panel type: %s', (panelType) => {
      const config = createValidConfig();
      config.panelOptions.type = panelType as any;
      expect(isValid(config)).toBe(true);
    });

    it('returns false when panelOptions.type is not a valid panel type', () => {
      const config = createValidConfig();
      config.panelOptions.type = 'invalid-panel-type' as any;
      expect(isValid(config)).toBe(false);
    });

    it('returns false when panelOptions.type is not a string', () => {
      const config = createValidConfig();
      (config.panelOptions as any).type = 123;
      expect(isValid(config)).toBe(false);
    });

    it('returns false when panelOptions.type is missing', () => {
      const config = createValidConfig();
      delete config.panelOptions.type;
      expect(isValid(config)).toBe(false);
    });
  });

  describe('queryOptions.queries validation', () => {
    it('returns true for valid queries array', () => {
      const config = createValidConfig();
      config.queryOptions.queries = [{ fn: 'avg' }, { fn: 'sum' }, { fn: 'max' }];
      expect(isValid(config)).toBe(true);
    });

    it('returns true when queries is an empty array', () => {
      const config = createValidConfig();
      config.queryOptions.queries = [];
      expect(isValid(config)).toBe(true);
    });

    it('returns false when queries is not an array', () => {
      const config = createValidConfig();
      (config.queryOptions as any).queries = 'not-an-array';
      expect(isValid(config)).toBe(false);
    });

    it('returns false when one query in array has invalid function', () => {
      const config = createValidConfig();
      config.queryOptions.queries = [{ fn: 'avg' }, { fn: 'invalid-function' as any }, { fn: 'sum' }];
      expect(isValid(config)).toBe(false);
    });
  });

  describe.each([['quantile'], ['histogram_quantile']])('percentiles validation for %s function', (fn) => {
    it('returns false when params is missing', () => {
      const config = createValidConfig();
      config.queryOptions.queries = [{ fn }];
      expect(isValid(config)).toBe(false);
    });

    it('returns true with valid params.percentiles array', () => {
      const config = createValidConfig();
      config.queryOptions.queries = [
        {
          fn,
          params: {
            percentiles: [99, 95, 90, 50],
          },
        },
      ];
      expect(isValid(config)).toBe(true);
    });

    it('returns false for empty params.percentiles array', () => {
      const config = createValidConfig();
      config.queryOptions.queries = [
        {
          fn,
          params: {
            percentiles: [],
          },
        },
      ];
      expect(isValid(config)).toBe(false);
    });

    it('returns false when params.percentiles is not an array', () => {
      const config = createValidConfig();
      config.queryOptions.queries = [
        {
          fn,
          params: {
            percentiles: 'not-an-array',
          },
        },
      ];
      expect(isValid(config)).toBe(false);
    });

    it('returns false when params.percentiles array contains non numbers', () => {
      const config = createValidConfig();
      config.queryOptions.queries = [
        {
          fn,
          params: {
            percentiles: [95, undefined, 50],
          },
        },
      ];
      expect(isValid(config)).toBe(false);
    });

    it('returns false when params.percentiles array contains numbers < 1 or > 99', () => {
      const config = createValidConfig();
      config.queryOptions.queries = [
        {
          fn,
          params: {
            percentiles: [95, 0, 90],
          },
        },
      ];
      expect(isValid(config)).toBe(false);
    });
  });
});
