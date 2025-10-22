import { AppPlugin, type AppRootProps } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import React, { lazy, Suspense } from 'react';

import { exposedComponentConfigs } from 'exposedComponents/components';
import { datasourceConfigLinkConfigs } from 'extensions/datasourceConfigLinks';
import { linkConfigs } from 'extensions/links';
import { logger } from 'shared/logger/logger';

const LazyApp = lazy(async () => {
  // Initialize i18n for scenes library
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [loadResources]);

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
  plugin.exposeComponent(exposedComponent as any);
}
