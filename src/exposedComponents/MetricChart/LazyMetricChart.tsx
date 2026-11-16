import { Trans } from '@grafana/i18n';
import React, { lazy, Suspense } from 'react';

import { type MetricChartProps } from './MetricChart';
import { ExposedComponentErrorBoundary } from '../ExposedComponentErrorBoundary';

const MetricChart = lazy(async () => {
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [loadResources]);

  return import('./MetricChart');
});

export const LazyMetricChart = (props: MetricChartProps) => (
  <ExposedComponentErrorBoundary boundaryName="metrics-drilldown-metric-chart" componentName="Metric Chart">
    <Suspense
      fallback={
        <div>
          <Trans i18nKey="lazy-loading.fallback">Loading...</Trans>
        </div>
      }
    >
      <MetricChart {...props} />
    </Suspense>
  </ExposedComponentErrorBoundary>
);
