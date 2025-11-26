import React, { lazy, Suspense } from 'react';

import { type LabelBreakdownProps } from './LabelBreakdown';

const LabelBreakdown = lazy(async () => {
  // Initialize i18n for scenes library
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [loadResources]);

  return import('./LabelBreakdown');
});

export const LazyLabelBreakdown = (props: LabelBreakdownProps) => (
  <Suspense fallback={<div>Loading...</div>}>
    <LabelBreakdown {...props} />
  </Suspense>
);
