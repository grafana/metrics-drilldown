import { config } from '@grafana/runtime';

import { PLUGIN_ID } from '../constants/plugin';

const versionCache = new Map<string, string | null>();

export function resetPluginVersionCache(pluginId?: string) {
  if (pluginId) {
    versionCache.delete(pluginId);
    return;
  }

  versionCache.clear();
}

export async function getPluginVersion(pluginId = PLUGIN_ID): Promise<string | null> {
  if (versionCache.has(pluginId)) {
    return versionCache.get(pluginId) ?? null;
  }

  try {
    const runtime = await import('@grafana/runtime');

    if (typeof runtime.getAppPluginVersion === 'function') {
      const version = await runtime.getAppPluginVersion(pluginId);
      versionCache.set(pluginId, version);
      return version;
    }
  } catch {
    // getAppPluginVersion not available (Grafana <12.4.0) or the plugin is not installed.
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- intentional fallback for Grafana <12.4.0
  const version = config.apps?.[pluginId]?.version ?? null;
  versionCache.set(pluginId, version);
  return version;
}
