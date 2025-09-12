import React, { lazy, Suspense } from 'react';

import { type LabelBreakdownProps } from './LabelBreakdown';

const LabelBreakdown = lazy(() => import('./LabelBreakdown'));

export const LazyLabelBreakdown = (props: LabelBreakdownProps) => (
  <Suspense fallback={<div>Loading...</div>}>
    <LabelBreakdown {...props} />
  </Suspense>
);
