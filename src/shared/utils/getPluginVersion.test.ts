import { getAppPluginVersion, logDebug } from '@grafana/runtime';

import { getPluginVersion } from './getPluginVersion';
import { PLUGIN_ID } from '../constants/plugin';

jest.mock('@grafana/runtime', () => ({
  getAppPluginVersion: jest.fn(),
  logDebug: jest.fn(),
}));

const getAppPluginVersionMock = jest.mocked(getAppPluginVersion);
const logDebugMock = jest.mocked(logDebug);

beforeEach(() => {
  jest.resetAllMocks();

  getAppPluginVersionMock.mockResolvedValue(null);
});

describe('getPluginVersion', () => {
  it('should return the version from getAppPluginVersion', async () => {
    getAppPluginVersionMock.mockResolvedValue('1.2.3');

    const version = await getPluginVersion();

    expect(version).toBe('1.2.3');
    expect(getAppPluginVersionMock).toHaveBeenCalledWith(PLUGIN_ID);
    expect(logDebugMock).not.toHaveBeenCalled();
  });

  it('should return null and log when getAppPluginVersion throws', async () => {
    getAppPluginVersionMock.mockRejectedValue(new Error('Service unavailable'));

    const version = await getPluginVersion();

    expect(version).toBeNull();
    expect(getAppPluginVersionMock).toHaveBeenCalledWith(PLUGIN_ID);
    expect(logDebugMock).toHaveBeenCalledWith('grafana-metricsdrilldown-app: getPluginVersion lookup failed', {
      error: 'Error: Service unavailable',
      pluginId: 'grafana-metricsdrilldown-app',
    });
  });
});
