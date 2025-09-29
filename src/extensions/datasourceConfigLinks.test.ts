import { createDatasourceUrl, datasourceConfigLinkConfigs, EXTENSION_DESCRIPTION } from './datasourceConfigLinks';

describe('DataSource Configuration Extensions', () => {
  describe('createDatasourceUrl', () => {
    it('should create URL with datasource UID for drilldown route', () => {
      const url = createDatasourceUrl('test-datasource-uid');
      expect(url).toContain('/a/grafana-metricsdrilldown-app/drilldown');
      expect(url).toContain('var-ds=test-datasource-uid');
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

      it('should return undefined for context without dataSource', () => {
        const result = config.configure?.({});
        expect(result).toBeUndefined();
      });

      it('should return undefined for context with incomplete dataSource', () => {
        const result = config.configure?.({
          dataSource: { type: 'prometheus' },
        });
        expect(result).toBeUndefined();
      });

      it('should return undefined for non-Prometheus datasources', () => {
        const context = {
          dataSource: { type: 'influxdb', uid: 'influx-1', name: 'InfluxDB' },
        };
        const result = config.configure?.(context);
        expect(result).toBeUndefined();
      });

      it('should return configuration for Prometheus datasources', () => {
        const context = {
          dataSource: { type: 'prometheus', uid: 'prom-1', name: 'Prometheus' },
        };
        const result = config.configure?.(context);
        expect(result).toBeDefined();
        expect(result?.path).toContain('/a/grafana-metricsdrilldown-app/drilldown');
        expect(result?.path).toContain('var-ds=prom-1');
        expect(result?.description).toContain(EXTENSION_DESCRIPTION);
      });
    });
  });
});
