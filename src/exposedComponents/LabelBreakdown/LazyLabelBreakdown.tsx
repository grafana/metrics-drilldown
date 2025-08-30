import React, { lazy, Suspense, useEffect, useState } from 'react';

import { type LabelBreakdownProps } from './LabelBreakdown';

const LabelBreakdownAsync = lazy(async () => {
  const module = await import('./LabelBreakdown');
  
  const AsyncWrapper = (props: LabelBreakdownProps): React.ReactElement => {
    const [Component, setComponent] = useState<React.ReactElement>(<div>Loading...</div>);
    
    useEffect(() => {
      module.default(props).then(element => setComponent(element as React.ReactElement));
    }, [props]);
    
    return Component;
  };
  
  return { default: AsyncWrapper };
});

export const LazyLabelBreakdown = (props: LabelBreakdownProps) => (
  <Suspense fallback={<div>Loading...</div>}>
    <LabelBreakdownAsync {...props} />
  </Suspense>
);
