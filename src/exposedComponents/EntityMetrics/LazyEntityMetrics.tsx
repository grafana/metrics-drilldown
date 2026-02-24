import { Trans } from '@grafana/i18n';
import React, { lazy, Suspense } from 'react';

import { type EntityMetricsProps } from './EntityMetrics';

const EntityMetrics = lazy(async () => {
  // Initialize i18n for scenes library before loading the component
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [loadResources]);

  return import('./EntityMetrics');
});

export const LazyEntityMetrics = (props: EntityMetricsProps) => (
  <Suspense
    fallback={
      <div>
        <Trans i18nKey="lazy-loading.fallback">Loading...</Trans>
      </div>
    }
  >
    <EntityMetrics {...props} />
  </Suspense>
);
