import { getPageNav } from './Trail';
import { MetricScene } from '../MetricScene/MetricScene';
import { MetricsReducer } from '../MetricsReducer/MetricsReducer';

const mockLocation = {
  pathname: '/a/grafana-metricsdrilldown-app/drilldown',
  search: '?metric=test_metric&actionView=breakdown',
  href: 'http://localhost:3001/a/grafana-metricsdrilldown-app/drilldown?metric=test_metric&actionView=breakdown',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

const mockMetricScene = new MetricScene({ metric: 'test_metric' });
const mockMetricsReducer = new MetricsReducer();

describe('Trail Component - Breadcrumb Logic Tests', () => {
  beforeEach(() => {
    // Reset location mock
    mockLocation.search = '?metric=test_metric&actionView=breakdown';
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
      // Mock URL with logs action view
      mockLocation.search = '?metric=test_metric&actionView=logs';

      const result = getPageNav(mockMetricScene, 'test_metric', 'Related logs');

      expect(result?.text).toBe('Related logs');
      expect(result?.url).toContain('actionView=logs');
    });

    it('should handle URL with invalid action view parameter', () => {
      // Mock URL with invalid action view
      mockLocation.search = '?metric=test_metric&actionView=invalid';

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
