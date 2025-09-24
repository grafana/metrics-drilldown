import {
  createDatasourceUrl,
  datasourceConfigLinkConfigs,
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
        expect(result?.description).toContain('Browse metrics in Grafana Metrics Drilldown');
      });

      it('should return configuration for Mimir datasources', () => {
        const context = {
          dataSource: { type: 'mimir', uid: 'mimir-1', name: 'Mimir' }
        };
        const result = config.configure?.(context);
        expect(result).toBeDefined();
        expect(result?.path).toContain('var-ds=mimir-1');
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
