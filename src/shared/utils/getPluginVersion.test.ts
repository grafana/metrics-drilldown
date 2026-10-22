import { getAppPluginVersion } from '@grafana/runtime';

import { logger } from 'shared/logger/logger';

import { getPluginVersion } from './getPluginVersion';
import { PLUGIN_ID } from '../constants/plugin';

jest.mock('@grafana/runtime', () => ({
  getAppPluginVersion: jest.fn(),
}));

jest.mock('shared/logger/logger', () => ({
  logger: {
    debug: jest.fn(),
  },
}));

const getAppPluginVersionMock = jest.mocked(getAppPluginVersion);
const loggerMock = jest.mocked(logger);

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
  });

  it('should return null and log when getAppPluginVersion throws', async () => {
    getAppPluginVersionMock.mockRejectedValue(new Error('Service unavailable'));

    const version = await getPluginVersion();

    expect(version).toBeNull();
    expect(getAppPluginVersionMock).toHaveBeenCalledWith(PLUGIN_ID);
    expect(loggerMock.debug).toHaveBeenCalled();
  });
});
