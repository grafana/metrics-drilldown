import { Trans } from '@grafana/i18n';
import React, { lazy, Suspense } from 'react';

import { type MetricHandoffProps } from './types';
import pluginJson from '../../plugin.json';
import { ExposedComponentErrorBoundary } from '../ExposedComponentErrorBoundary';

const MetricHandoff = lazy(async () => {
  const { initPluginTranslations } = await import('@grafana/i18n');
  await initPluginTranslations(pluginJson.id);
  return import('./MetricHandoff');
});

export const LazyMetricHandoff = (props: MetricHandoffProps) => (
  <ExposedComponentErrorBoundary boundaryName="metrics-drilldown-metric-handoff" componentName="Metric Handoff">
    <Suspense
      fallback={
        <div>
          <Trans i18nKey="lazy-loading.fallback">Loading...</Trans>
        </div>
      }
    >
      <MetricHandoff {...props} />
    </Suspense>
  </ExposedComponentErrorBoundary>
);
