import React, { lazy, Suspense } from 'react';

import { type EntityMetricsProps } from './EntityMetrics';

const EntityMetrics = lazy(() => import('./EntityMetrics'));

export const LazyEntityMetrics = (props: EntityMetricsProps) => (
  <Suspense fallback={<div>Loading...</div>}>
    <EntityMetrics {...props} />
  </Suspense>
);
