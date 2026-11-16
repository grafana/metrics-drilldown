import { t } from '@grafana/i18n';
import { type PromQuery } from '@grafana/prometheus';
import { Alert } from '@grafana/ui';
import React, { useLayoutEffect, useMemo } from 'react';

import {
  createMetricScene,
  isValidMetricSceneOptions,
  observeMetricQueries,
  type MetricSceneOptions,
} from '../metrics-molecules/metricScene';

export interface MetricChartProps extends MetricSceneOptions {
  /**
   * Current targets with molecule-local datasource/filter variables expanded and the app-only
   * ignore-usage matcher removed. Literal filter dollars use PromQL Unicode escapes so they
   * survive datasource/backend interpolation. Built-in query macros (e.g. $__rate_interval)
   * are left for the host/Explore to resolve.
   */
  onQueriesChange?: (queries: PromQuery[]) => void;
}

export function MetricChart({ onQueriesChange, ...scope }: Readonly<MetricChartProps>) {
  // Host filter arrays need not be referentially stable. Rebuild only when the explicit scope changes.
  const scopeKey = JSON.stringify(scope);
  const model = useMemo(() => {
    const options: MetricSceneOptions = JSON.parse(scopeKey);
    return isValidMetricSceneOptions(options) ? createMetricScene(options) : undefined;
  }, [scopeKey]);

  // Layout cleanup disconnects the old host callback at commit, before a new scope can activate.
  useLayoutEffect(
    () => (model && onQueriesChange ? observeMetricQueries(model.panel, onQueriesChange) : undefined),
    [model, onQueriesChange]
  );

  if (!model) {
    return <Alert severity="error" title={t('metric-chart.invalid-scope', 'Invalid metric chart scope')} />;
  }

  return <model.scene.Component model={model.scene} />;
}

export default MetricChart;
