import { Trans } from '@grafana/i18n';
import React, { lazy, Suspense } from 'react';

import { type MiniBreakdownProps } from './MiniBreakdown';
import { ExposedComponentErrorBoundary } from '../ExposedComponentErrorBoundary';

const MiniBreakdown = lazy(async () => {
  // Initialize i18n for scenes library before loading the component
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [loadResources]);

  const { patchSceneQueryRunnerFilters } = await import('App/patchSceneQueryRunner');
  patchSceneQueryRunnerFilters();

  return import('./MiniBreakdown');
});

export const LazyMiniBreakdown = (props: MiniBreakdownProps) => (
  <ExposedComponentErrorBoundary
    boundaryName="metrics-drilldown-mini-breakdown"
    componentName="Mini Breakdown"
  >
    <Suspense
      fallback={
        <div>
          <Trans i18nKey="lazy-loading.fallback">Loading...</Trans>
        </div>
      }
    >
      <MiniBreakdown {...props} />
    </Suspense>
  </ExposedComponentErrorBoundary>
);
