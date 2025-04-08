import { sceneGraph, UrlSyncContextProvider } from '@grafana/scenes';
import React, { useEffect, useState } from 'react';

import { getTrailStore } from 'TrailStore/TrailStore';
import { MetricsReducer } from 'WingmanDataTrail/MetricsReducer';
import { VAR_VARIANT, type VariantVariable } from 'WingmanOnboarding/VariantVariable';

import type { DataTrail } from 'DataTrail';

export default function Trail({ trail, variant }: { trail: DataTrail; variant: string }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      if (trail.state.metric) {
        getTrailStore().setRecentTrail(trail);
      }
      setIsInitialized(true);
    }

    (sceneGraph.getVariables(trail).getByName(VAR_VARIANT) as VariantVariable)!.setState({
      value: variant,
    });

    trail.setState({
      topScene: new MetricsReducer(),
    });
  }, [trail, isInitialized, variant]);

  if (!isInitialized) {
    return null;
  }

  return (
    <UrlSyncContextProvider scene={trail} createBrowserHistorySteps={true}>
      <trail.Component model={trail} />
    </UrlSyncContextProvider>
  );
}
