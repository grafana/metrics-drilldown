import { AppPlugin, type AppRootProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';
import { compare } from 'compare-versions';
import React, { lazy, Suspense } from 'react';

import { entityMetricsConfig } from 'exposedComponents/EntityMetrics/config';
import { labelBreakdownConfig } from 'exposedComponents/LabelBreakdown/config';
import { miniBreakdownConfig } from 'exposedComponents/MiniBreakdown/config';
import { sourceMetricsConfig } from 'exposedComponents/SourceMetrics/config';
import { datasourceConfigLinkConfigs } from 'extensions/datasourceConfigLinks';
import { linkConfigs } from 'extensions/links';

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
  const pluginLoaders = compare(config.buildInfo.version ?? '0.0.0', '12.1.0', '<') ? [loadResources] : [];
  await initPluginTranslations(pluginJson.id, pluginLoaders);

  // Initialize WASM-based outlier detection
  const { wasmSupported } = await import('./shared/services/sorting');
  const { default: initOutlier } = await import('@bsull/augurs/outlier');
  const { logger } = await import('shared/logger/logger');

  if (wasmSupported()) {
    try {
      await initOutlier();
    } catch (e) {
      logger.error(e as Error, { message: 'Error while initializing outlier detection' });
    }
  } else {
    logger.warn('WASM not supported, outlier detection will not work');
  }

  // TODO: remove once the upstream @grafana/scenes regression is fixed.
  // The patch is also applied inside each LazyExposedComponent (Entity/Label/Mini/SourceMetrics),
  // because exposed components mount in host Grafana surfaces without going through LazyApp.
  // The patch is idempotent (Symbol.for guard in patchSceneQueryRunner.ts), so multiple
  // lazy boundaries calling it are safe. Kept dynamic to avoid pulling @grafana/scenes
  // and the logger graph into the entry chunk (see bundle-stats history in extensions/links.ts).
  const { patchSceneQueryRunnerFilters } = await import('App/patchSceneQueryRunner');
  patchSceneQueryRunnerFilters();

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

plugin.exposeComponent(entityMetricsConfig);
plugin.exposeComponent(labelBreakdownConfig);
plugin.exposeComponent(miniBreakdownConfig);
plugin.exposeComponent(sourceMetricsConfig);
