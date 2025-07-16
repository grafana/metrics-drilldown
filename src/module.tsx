import { AppPlugin, type AppRootProps } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import React, { lazy, Suspense } from 'react';

import { linkConfigs } from 'extensions/links';
import { logger } from 'tracking/logger/logger';

const LazyApp = lazy(async () => {
  const { wasmSupported } = await import('./services/sorting');
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

for (const linkConfig of linkConfigs) {
  plugin.addLink(linkConfig);
}
