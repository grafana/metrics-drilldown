import { AppPlugin, type AppRootProps } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import React, { lazy, Suspense } from 'react';

import { type AppConfigProps } from './App/AppConfig';

const LazyApp = lazy(async () => {
  const { wasmSupported } = await import('./services/sorting');
  const { default: initOutlier } = await import('@bsull/augurs/outlier');

  if (wasmSupported()) {
    await initOutlier();
    console.info('wasmSupported');
  }

  return import('./App/App');
});

const LazyAppConfig = lazy(() => import('./App/AppConfig'));

const App = (props: AppRootProps) => (
  <Suspense fallback={<LoadingPlaceholder text="" />}>
    <LazyApp {...props} />
  </Suspense>
);

const AppConfig = (props: AppConfigProps) => (
  <Suspense fallback={<LoadingPlaceholder text="" />}>
    <LazyAppConfig {...props} />
  </Suspense>
);

export const plugin = new AppPlugin<{}>().setRootPage(App).addConfigPage({
  title: 'Configuration',
  icon: 'cog',
  body: AppConfig,
  id: 'configuration',
});
