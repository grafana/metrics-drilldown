import { config } from '@grafana/runtime';

import { getPluginVersion, resetPluginVersionCache } from './getPluginVersion';
import { PLUGIN_ID } from '../constants/plugin';

let mockGetAppPluginVersion: jest.Mock | undefined;

jest.mock('@grafana/runtime', () => ({
  config: {
    apps: {},
  },
  get getAppPluginVersion() {
    return mockGetAppPluginVersion;
  },
}));

const mockConfig = config as jest.Mocked<typeof config>;

beforeEach(() => {
  resetPluginVersionCache();
  // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- testing fallback for Grafana <12.4.0
  mockConfig.apps = {};
  mockGetAppPluginVersion = undefined;
});

describe('getPluginVersion', () => {
  describe('when getAppPluginVersion is available (Grafana >= 12.4.0)', () => {
    it('should return the version from getAppPluginVersion', async () => {
      mockGetAppPluginVersion = jest.fn().mockResolvedValue('1.2.3');

      const version = await getPluginVersion();

      expect(version).toBe('1.2.3');
      expect(mockGetAppPluginVersion).toHaveBeenCalledWith(PLUGIN_ID);
    });
  });

  describe('when getAppPluginVersion is not available (Grafana < 12.4.0)', () => {
    it('should fall back to config.apps version', async () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- testing fallback for Grafana <12.4.0
      mockConfig.apps = {
        // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- testing fallback for Grafana <12.4.0
        [PLUGIN_ID]: { version: '0.9.0' } as (typeof config.apps)[string],
      };

      const version = await getPluginVersion();

      expect(version).toBe('0.9.0');
    });

    it('should return null when no version is available', async () => {
      const version = await getPluginVersion();

      expect(version).toBeNull();
    });
  });

  describe('caching', () => {
    it('should cache the version after the first call', async () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- testing fallback for Grafana <12.4.0
      mockConfig.apps = {
        // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- testing fallback for Grafana <12.4.0
        [PLUGIN_ID]: { version: '0.9.0' } as (typeof config.apps)[string],
      };

      const first = await getPluginVersion();
      // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- testing fallback for Grafana <12.4.0
      mockConfig.apps = {};
      const second = await getPluginVersion();

      expect(first).toBe('0.9.0');
      expect(second).toBe('0.9.0');
    });

    it('caches versions independently by plugin id', async () => {
      mockGetAppPluginVersion = jest.fn().mockImplementation(async (pluginId: string) => `${pluginId}-version`);

      await expect(getPluginVersion('grafana-slo-app')).resolves.toBe('grafana-slo-app-version');
      await expect(getPluginVersion(PLUGIN_ID)).resolves.toBe(`${PLUGIN_ID}-version`);
      await expect(getPluginVersion('grafana-slo-app')).resolves.toBe('grafana-slo-app-version');

      expect(mockGetAppPluginVersion).toHaveBeenCalledTimes(2);
    });

    it('can reset one plugin without invalidating another', async () => {
      mockGetAppPluginVersion = jest.fn().mockResolvedValueOnce('slo-v1').mockResolvedValueOnce('metrics-v1');

      await getPluginVersion('grafana-slo-app');
      await getPluginVersion(PLUGIN_ID);
      resetPluginVersionCache('grafana-slo-app');
      mockGetAppPluginVersion.mockResolvedValueOnce('slo-v2');

      await expect(getPluginVersion('grafana-slo-app')).resolves.toBe('slo-v2');
      await expect(getPluginVersion(PLUGIN_ID)).resolves.toBe('metrics-v1');
    });
  });
});
