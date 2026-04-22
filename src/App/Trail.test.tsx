import { getPageNav } from './Trail';
import { MetricScene } from '../MetricScene/MetricScene';
import { MetricsReducer } from '../MetricsReducer/MetricsReducer';

const DEFAULT_URL =
  'http://localhost:3001/a/grafana-metricsdrilldown-app/drilldown?metric=test_metric&actionView=breakdown';

const mockMetricScene = new MetricScene({ metric: 'test_metric' });
const mockMetricsReducer = new MetricsReducer();

describe('Trail Component - Breadcrumb Logic Tests', () => {
  beforeEach(() => {
    __setWindowLocation(DEFAULT_URL);
  });

  describe('When no metric is selected (MetricsReducer)', () => {
    it('should return "All metrics" breadcrumb', () => {
      const result = getPageNav(mockMetricsReducer, undefined, '');

      expect(result).toEqual({ text: 'All metrics' });
    });
  });

  describe('When a metric is selected (MetricScene)', () => {
    it('should return metric name and default action view breadcrumb', () => {
      const result = getPageNav(mockMetricScene, 'test_metric', 'Breakdown');

      expect(result).toBeDefined();
      expect(result?.text).toBe('Breakdown');
      expect(result?.parentItem?.text).toBe('test_metric');
    });

    it('should handle URL with different action view parameter', () => {
      __setWindowLocation({ search: '?metric=test_metric&actionView=logs' });

      const result = getPageNav(mockMetricScene, 'test_metric', 'Related logs');

      expect(result?.text).toBe('Related logs');
      expect(result?.url).toContain('actionView=logs');
    });

    it('should handle URL with invalid action view parameter', () => {
      __setWindowLocation({ search: '?metric=test_metric&actionView=invalid' });

      const result = getPageNav(mockMetricScene, 'test_metric', 'Breakdown');

      // Should fall back to default action view
      expect(result?.text).toBe('Breakdown');
      expect(result?.url).toContain('actionView=invalid'); // URL should still contain the invalid parameter
    });

    it('should generate correct URLs for breadcrumb navigation', () => {
      const result = getPageNav(mockMetricScene, 'test_metric', 'Breakdown');

      expect(result?.url).toContain('actionView=breakdown');
      expect(result?.parentItem?.url).toContain('actionView=breakdown');
    });

    it('should reset var-groupby to $__all in the metric breadcrumb URL', () => {
      __setWindowLocation({ search: '?metric=test_metric&actionView=related&var-groupby=instance' });

      const result = getPageNav(mockMetricScene, 'test_metric', 'Related metrics');

      expect(result?.parentItem?.url).not.toContain('instance');
      expect(result?.parentItem?.url).toContain('var-groupby=%24__all');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined metric gracefully', () => {
      const result = getPageNav(mockMetricsReducer, undefined, '');

      expect(result).toEqual({ text: 'All metrics' });
    });

    it('should handle empty metric name', () => {
      const result = getPageNav(mockMetricScene, '', 'Breakdown');

      // Empty string is falsy, so it should return undefined
      expect(result).toBeUndefined();
    });

    it('should handle undefined topScene', () => {
      const result = getPageNav(undefined, 'test_metric', 'Breakdown');

      expect(result).toBeUndefined();
    });
  });
});
