import { AppPlugin, type AppRootProps } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import React, { lazy, Suspense } from 'react';

import { LabelBreakdown } from 'exposedComponents';
import { linkConfigs } from 'extensions/links';
import { logger } from 'tracking/logger/logger';

const LazyApp = lazy(async () => {
  const { wasmSupported } = await import('./services/sorting');
  const { default: initOutlier } = await import('@bsull/augurs/outlier');

  if (wasmSupported()) {
    await initOutlier();
    logger.info('WASM supported');
  }

  return import('./App/App');
});

const App = (props: AppRootProps) => (
  <Suspense fallback={<LoadingPlaceholder text="" />}>
    <LazyApp {...props} />
  </Suspense>
);

export const plugin = new AppPlugin<{}>().setRootPage(App).exposeComponent({
  id: 'grafana-metricsdrilldown-app/label-breakdown-component/v1',
  title: 'Label Breakdown',
  description: 'A metrics label breakdown view from the Metrics Drilldown app.',
  component: LabelBreakdown,
});

for (const linkConfig of linkConfigs) {
  plugin.addLink(linkConfig);
}
