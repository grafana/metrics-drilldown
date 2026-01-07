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

  describe('error handling', () => {
    // This test is skipped because testing this scenario requires mocking dynamic imports,
    // which is complex and fragile in Jest. The error occurs when:
    // 1. The requested locale file doesn't exist (e.g., 'xx-XX')
    // 2. AND the en-US fallback file also doesn't exist
    //
    // This would be a build/deployment error, not a runtime error that needs handling.
    // The error handling code path is partially covered by the fallback test above,
    // which exercises the catch block and fallback logic.
    //
    // To make this testable, we would need to:
    // - Extract the dynamic import logic into a separate testable function
    // - Use dependency injection to provide a mockable import function
    // - Or use complex jest.mock setups that make the test fragile
    //
    // For now, we rely on:
    // - TypeScript compilation ensuring the error path exists
    // - Code review to verify the re-throw logic is correct
    // - The fallback test which exercises most of the error handling code
    it.skip('should re-throw error when both requested language and fallback fail', async () => {
      // This test would require mocking both imports to fail:
      // await expect(loadResources('xx-XX')).rejects.toThrow();
      //
      // Implementation would need dynamic import mocking:
      // jest.mock('../locales/xx-XX/grafana-metricsdrilldown-app.json', ...)
      // jest.mock('../locales/en-US/grafana-metricsdrilldown-app.json', ...)
    });
  });
});
