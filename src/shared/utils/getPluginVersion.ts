import { getAppPluginVersion, logDebug } from '@grafana/runtime';

import { PLUGIN_ID } from '../constants/plugin';

export async function getPluginVersion(pluginId = PLUGIN_ID): Promise<string | null> {
  try {
    const version = await getAppPluginVersion(pluginId);
    return version;
  } catch (error) {
    logDebug(`${PLUGIN_ID}: getPluginVersion lookup failed`, { pluginId, error: String(error) });
  }

  return null;
}
