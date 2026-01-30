import { loadResources } from '../loadResources';

describe('loadResources', () => {
  describe('successful resource loading', () => {
    it('should load en-US resources when language is en-US', async () => {
      const result = await loadResources('en-US');

      expect(result).toMatchObject({
        trail: {
          breadcrumb: {
            metrics: 'Metrics',
            'all-metrics': 'All metrics',
          },
        },
      });
    });

    it('should load en-US resources when language is undefined', async () => {
      const result = await loadResources('');

      expect(result).toMatchObject({
        trail: {
          breadcrumb: {
            metrics: 'Metrics',
            'all-metrics': 'All metrics',
          },
        },
      });
    });

    it('should load specific language resources when available', async () => {
      const result = await loadResources('es-ES');

      // Verify the locale loads and has the expected structure
      // (translations may be empty strings from Crowdin until translated)
      expect(result).toHaveProperty('trail.breadcrumb.metrics');
      expect(result).toHaveProperty('trail.breadcrumb.all-metrics');
    });
  });

  describe('fallback behavior', () => {
    it('should fallback to en-US when requested language is not found', async () => {
      // Use a non-existent locale to test fallback behavior
      // (fr-FR exists in locales, so it won't trigger fallback)
      const result = await loadResources('xx-XX');

      expect(result).toMatchObject({
        trail: {
          breadcrumb: {
            metrics: 'Metrics',
            'all-metrics': 'All metrics',
          },
        },
      });
    });
  });
});
