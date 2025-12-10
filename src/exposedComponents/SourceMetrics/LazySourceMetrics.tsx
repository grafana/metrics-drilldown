import React, { lazy, Suspense } from 'react';

import { type SourceMetricsProps } from './SourceMetrics';

const LabelBreakdown = lazy(async () => {
  // Initialize i18n for scenes library
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [loadResources]);

  return import('./SourceMetrics');
});

export const LazySourceMetrics = (props: SourceMetricsProps) => (
  <Suspense fallback={<div>Loading...</div>}>
    <LabelBreakdown {...props} />
  </Suspense>
);
