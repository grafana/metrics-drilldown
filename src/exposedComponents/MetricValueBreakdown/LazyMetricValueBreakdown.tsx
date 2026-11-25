import { Trans } from '@grafana/i18n';
import React, { lazy, Suspense } from 'react';

import { type MetricValueBreakdownProps } from './MetricValueBreakdown';
import { ExposedComponentErrorBoundary } from '../ExposedComponentErrorBoundary';

const MetricValueBreakdown = lazy(async () => {
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [loadResources]);

  return import('./MetricValueBreakdown');
});

export const LazyMetricValueBreakdown = (props: MetricValueBreakdownProps) => (
  <ExposedComponentErrorBoundary
    boundaryName="metrics-drilldown-metric-value-breakdown"
    componentName="Metric Value Breakdown"
  >
    <Suspense
      fallback={
        <div>
          <Trans i18nKey="lazy-loading.fallback">Loading...</Trans>
        </div>
      }
    >
      <MetricValueBreakdown {...props} />
    </Suspense>
  </ExposedComponentErrorBoundary>
);
