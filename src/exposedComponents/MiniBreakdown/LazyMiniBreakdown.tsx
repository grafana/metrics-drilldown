import { Trans } from '@grafana/i18n';
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
  <Suspense
    fallback={
      <div>
        <Trans i18nKey="lazy-loading.fallback">Loading...</Trans>
      </div>
    }
  >
    <MiniBreakdown {...props} />
  </Suspense>
);
