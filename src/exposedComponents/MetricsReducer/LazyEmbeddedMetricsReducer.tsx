import React, { lazy, Suspense } from 'react';

import { type EmbeddedMetricsReducerProps } from './EmbeddedMetricsReducer';

const EmbeddedMetricsReducer = lazy(() => import('./EmbeddedMetricsReducer'));

export const LazyEmbeddedMetricsReducer = (props: EmbeddedMetricsReducerProps) => (
  <Suspense fallback={<div>Loading...</div>}>
    <EmbeddedMetricsReducer {...props} />
  </Suspense>
);
