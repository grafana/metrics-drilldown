import {
  createDatasourceUrl,
  datasourceConfigLinkConfigs,
  getDatasourceCapabilities,
  getDescriptionForDatasource,
  isPrometheusCompatible,
  PROMETHEUS_DATASOURCE_TYPES
} from './datasourceConfigLinks';
import { ROUTES } from '../shared/constants/routes';

describe('DataSource Configuration Extensions', () => {
  describe('isPrometheusCompatible', () => {
    it('should return true for Prometheus datasource types', () => {
      expect(isPrometheusCompatible('prometheus')).toBe(true);
      expect(isPrometheusCompatible('mimir')).toBe(true);
      expect(isPrometheusCompatible('cortex')).toBe(true);
      expect(isPrometheusCompatible('thanos')).toBe(true);
    });

    it('should return false for non-Prometheus datasource types', () => {
      expect(isPrometheusCompatible('influxdb')).toBe(false);
      expect(isPrometheusCompatible('elasticsearch')).toBe(false);
      expect(isPrometheusCompatible('mysql')).toBe(false);
      expect(isPrometheusCompatible('postgres')).toBe(false);
    });

    it('should return false for undefined or empty values', () => {
      expect(isPrometheusCompatible()).toBe(false);
      expect(isPrometheusCompatible('')).toBe(false);
    });
  });

  describe('getDatasourceCapabilities', () => {
    it('should return correct capabilities for prometheus', () => {
      const capabilities = getDatasourceCapabilities('prometheus');
      expect(capabilities).toEqual(['native_histograms', 'exemplars', 'recording_rules']);
    });

    it('should return correct capabilities for mimir', () => {
      const capabilities = getDatasourceCapabilities('mimir');
      expect(capabilities).toEqual(['native_histograms', 'exemplars', 'recording_rules', 'multi_tenancy']);
    });

    it('should return correct capabilities for cortex', () => {
      const capabilities = getDatasourceCapabilities('cortex');
      expect(capabilities).toEqual(['exemplars', 'recording_rules']);
    });

    it('should return correct capabilities for thanos', () => {
      const capabilities = getDatasourceCapabilities('thanos');
      expect(capabilities).toEqual(['exemplars', 'recording_rules', 'downsampling']);
    });

    it('should return empty array for unknown datasource types', () => {
      const capabilities = getDatasourceCapabilities('unknown');
      expect(capabilities).toEqual([]);
    });
  });

  describe('getDescriptionForDatasource', () => {
    it('should return basic description for cortex with exemplars', () => {
      const description = getDescriptionForDatasource('cortex');
      expect(description).toBe('Browse metrics without writing PromQL queries. View trace exemplars');
    });

    it('should include native histogram support for prometheus', () => {
      const description = getDescriptionForDatasource('prometheus');
      expect(description).toContain('Browse metrics without writing PromQL queries');
      expect(description).toContain('Includes native histogram support');
      expect(description).toContain('View trace exemplars');
    });

    it('should include native histogram support for mimir', () => {
      const description = getDescriptionForDatasource('mimir');
      expect(description).toContain('Browse metrics without writing PromQL queries');
      expect(description).toContain('Includes native histogram support');
      expect(description).toContain('View trace exemplars');
    });

    it('should include exemplars for thanos', () => {
      const description = getDescriptionForDatasource('thanos');
      expect(description).toContain('Browse metrics without writing PromQL queries');
      expect(description).toContain('View trace exemplars');
      expect(description).not.toContain('native histogram');
    });
  });

  describe('createDatasourceUrl', () => {
    it('should create URL with datasource UID for drilldown route', () => {
      const url = createDatasourceUrl('test-datasource-uid');
      expect(url).toContain('/a/grafana-metricsdrilldown-app/drilldown');
      expect(url).toContain('var-ds=test-datasource-uid');
    });

    it('should create URL with custom route', () => {
      const url = createDatasourceUrl('test-datasource-uid', ROUTES.Trail);
      expect(url).toContain('/a/grafana-metricsdrilldown-app/trail');
      expect(url).toContain('var-ds=test-datasource-uid');
    });

    it('should handle special characters in datasource UID', () => {
      const url = createDatasourceUrl('test-datasource-uid-with-special-chars!@#');
      expect(url).toContain('var-ds=test-datasource-uid-with-special-chars%21%40%23');
    });
  });

  describe('datasourceConfigLinkConfigs', () => {
    it('should contain one configuration', () => {
      expect(datasourceConfigLinkConfigs).toHaveLength(1);
    });

    it('should have correct base properties', () => {
      const config = datasourceConfigLinkConfigs[0];
      expect(config.title).toBe('Open in Metrics Drilldown');
      expect(config.description).toContain('Browse metrics in Grafana Metrics Drilldown');
      expect(config.category).toBe('metrics-drilldown');
      expect(config.icon).toBe('drilldown');
      expect(config.path).toContain('/a/grafana-metricsdrilldown-app/drilldown');
    });

    describe('configure function', () => {
      const config = datasourceConfigLinkConfigs[0];

      it('should return undefined for undefined context', () => {
        const result = config.configure?.(undefined);
        expect(result).toBeUndefined();
      });

      it('should return undefined for context without dataSource', () => {
        const result = config.configure?.({});
        expect(result).toBeUndefined();
      });

      it('should return undefined for context with incomplete dataSource', () => {
        const result = config.configure?.({
          dataSource: { type: 'prometheus' }
        });
        expect(result).toBeUndefined();
      });

      it('should return undefined for non-Prometheus datasources', () => {
        const context = {
          dataSource: { type: 'influxdb', uid: 'influx-1', name: 'InfluxDB' }
        };
        const result = config.configure?.(context);
        expect(result).toBeUndefined();
      });

      it('should return configuration for Prometheus datasources', () => {
        const context = {
          dataSource: { type: 'prometheus', uid: 'prom-1', name: 'Prometheus' }
        };
        const result = config.configure?.(context);
        expect(result).toBeDefined();
        expect(result?.path).toContain('/a/grafana-metricsdrilldown-app/drilldown');
        expect(result?.path).toContain('var-ds=prom-1');
        expect(result?.description).toContain('Browse metrics without writing PromQL queries');
      });

      it('should return configuration for Mimir datasources', () => {
        const context = {
          dataSource: { type: 'mimir', uid: 'mimir-1', name: 'Mimir' }
        };
        const result = config.configure?.(context);
        expect(result).toBeDefined();
        expect(result?.path).toContain('var-ds=mimir-1');
        expect(result?.description).toContain('native histogram support');
      });

      it('should return configuration for Cortex datasources', () => {
        const context = {
          dataSource: { type: 'cortex', uid: 'cortex-1', name: 'Cortex' }
        };
        const result = config.configure?.(context);
        expect(result).toBeDefined();
        expect(result?.path).toContain('var-ds=cortex-1');
      });

      it('should return configuration for Thanos datasources', () => {
        const context = {
          dataSource: { type: 'thanos', uid: 'thanos-1', name: 'Thanos' }
        };
        const result = config.configure?.(context);
        expect(result).toBeDefined();
        expect(result?.path).toContain('var-ds=thanos-1');
      });
    });
  });

  describe('PROMETHEUS_DATASOURCE_TYPES constant', () => {
    it('should include all expected Prometheus-compatible types', () => {
      expect(PROMETHEUS_DATASOURCE_TYPES).toEqual(['prometheus', 'mimir', 'cortex', 'thanos']);
    });

    it('should be used by isPrometheusCompatible function', () => {
      PROMETHEUS_DATASOURCE_TYPES.forEach(type => {
        expect(isPrometheusCompatible(type)).toBe(true);
      });
    });
  });
});
