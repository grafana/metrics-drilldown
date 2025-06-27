import { isPrometheusDataSource } from './utils.datasource';

describe('isPrometheusDataSource', () => {
  it('should return true for a core Prometheus datasource', () => {
    const ds = { type: 'prometheus', uid: 'prometheus' };
    expect(isPrometheusDataSource(ds)).toBe(true);
  });

  it('should return true for a Grafana developed Prometheus datasource', () => {
    const ds = { type: 'grafana-amazonprometheus-datasource', uid: 'grafana-amazonprometheus-datasource' };
    expect(isPrometheusDataSource(ds)).toBe(true);
  });

  it('should return false for non-Prometheus datasource', () => {
    const ds = { type: 'grafana-test-datasource', uid: 'grafana-test-datasource' };
    expect(isPrometheusDataSource(ds)).toBe(false);
  });

  it('should return false for object without type property', () => {
    const ds = { name: 'prometheus', uid: 'prometheus' };
    expect(isPrometheusDataSource(ds)).toBe(false);
  });
});
