import { getAppPluginVersion } from '@grafana/runtime';

import { logger } from 'shared/logger/logger';

import { PLUGIN_ID } from '../constants/plugin';

export async function getPluginVersion(pluginId = PLUGIN_ID): Promise<string | null> {
  return getAppPluginVersion(pluginId).catch(() => {
    logger.debug('getAppPluginVersion look up failed', { pluginId });
    return null;
  });
}
