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

      expect(result).toMatchObject({
        trail: {
          breadcrumb: {
            metrics: 'Métricas',
            'all-metrics': 'Todas las métricas',
          },
        },
      });
    });
  });

  describe('fallback behavior', () => {
    it('should fallback to en-US when requested language is not found', async () => {
      const result = await loadResources('fr-FR');

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
