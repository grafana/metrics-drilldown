import { logger } from '../../shared/logger/logger';
import { loadResources } from '../loadResources';

jest.mock('../../shared/logger/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('loadResources', () => {
  describe('default language short-circuit', () => {
    it('should return an empty object when language is en-US', async () => {
      const result = await loadResources('en-US');

      expect(result).toEqual({});
    });

    it('should return an empty object when language is empty string', async () => {
      const result = await loadResources('');

      expect(result).toEqual({});
    });

    it('should load specific language resources when available', async () => {
      const result = await loadResources('es-ES');

      // Verify the locale loads and has the expected structure
      // (translations may be empty strings from Crowdin until translated)
      expect(result).toHaveProperty('trail.breadcrumb.metrics');
      expect(result).toHaveProperty('trail.breadcrumb.all-metrics');
    });
  });

  describe('missing locale handling', () => {
    it('should return an empty object and warn when requested language is not found', async () => {
      const result = await loadResources('xx-XX');

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load translations for locale "xx-XX"'),
        expect.anything()
      );
    });
  });
});
