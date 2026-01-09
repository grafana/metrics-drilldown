import { AppPlugin, type AppRootProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';
import React, { lazy, Suspense } from 'react';
import { lt } from 'semver';

import { exposedComponentConfigs } from 'exposedComponents/components';
import { datasourceConfigLinkConfigs } from 'extensions/datasourceConfigLinks';
import { linkConfigs } from 'extensions/links';
import { logger } from 'shared/logger/logger';

import pluginJson from './plugin.json';

const LazyApp = lazy(async () => {
  const { initPluginTranslations } = await import('@grafana/i18n');

  // Initialize i18n for scenes library
  const { loadResources: scenesLoadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [scenesLoadResources]);

  // Initialize i18n for this plugin
  // Before Grafana 12.1.0, plugins must load their own resources
  // After 12.1.0, Grafana handles resource loading
  const { loadResources } = await import('./i18n/loadResources');
  const pluginLoaders = lt(config?.buildInfo?.version || '0.0.0', '12.1.0') ? [loadResources] : [];
  await initPluginTranslations(pluginJson.id, pluginLoaders);

  // Initialize WASM-based outlier detection
  const { wasmSupported } = await import('./shared/services/sorting');
  const { default: initOutlier } = await import('@bsull/augurs/outlier');

  if (wasmSupported()) {
    try {
      await initOutlier();
    } catch (e) {
      logger.error(e as Error, { message: 'Error while initializing outlier detection' });
    }
  } else {
    logger.warn('WASM not supported, outlier detection will not work');
  }

  return import('./App/App');
});

const App = (props: AppRootProps) => (
  <Suspense fallback={<LoadingPlaceholder text="" />}>
    <LazyApp {...props} />
  </Suspense>
);

export const plugin = new AppPlugin<{}>().setRootPage(App);

// Register all extension types
for (const linkConfig of [...linkConfigs, ...datasourceConfigLinkConfigs]) {
  plugin.addLink(linkConfig);
}

for (const exposedComponent of exposedComponentConfigs) {
  plugin.exposeComponent(exposedComponent);
}
