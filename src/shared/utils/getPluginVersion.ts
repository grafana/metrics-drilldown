import { config } from '@grafana/runtime';

import { PLUGIN_ID } from '../constants/plugin';

let cachedVersion: string | null = null;
let hasCached = false;

export function resetPluginVersionCache() {
  cachedVersion = null;
  hasCached = false;
}

export async function getPluginVersion(): Promise<string | null> {
  if (hasCached) {
    return cachedVersion;
  }

  // TODO(2026-10-18): grafanaDependency is now >=13.1.0, so getAppPluginVersion is always available.
  // Remove this try/catch and the config.apps fallback below; call runtime.getAppPluginVersion directly.
  try {
    const runtime = await import('@grafana/runtime');

    if (typeof runtime.getAppPluginVersion === 'function') {
      cachedVersion = await runtime.getAppPluginVersion(PLUGIN_ID);
      hasCached = true;
      return cachedVersion;
    }
  } catch {
    // getAppPluginVersion not available (Grafana <12.4.0)
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- intentional fallback for Grafana <12.4.0
  cachedVersion = config.apps?.[PLUGIN_ID]?.version ?? null;
  hasCached = true;
  return cachedVersion;
}
