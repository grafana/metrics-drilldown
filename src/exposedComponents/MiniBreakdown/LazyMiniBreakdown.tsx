import React, { lazy, Suspense } from 'react';

import { type MiniBreakdownProps } from './MiniBreakdown';

const MiniBreakdown = lazy(async () => {
  // Initialize i18n for scenes library before loading the component
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [loadResources]);

  return import('./MiniBreakdown');
});

export const LazyMiniBreakdown = (props: MiniBreakdownProps) => (
  <Suspense fallback={<div>Loading...</div>}>
    <MiniBreakdown {...props} />
  </Suspense>
);
