import { UrlSyncContextProvider } from '@grafana/scenes';
import React, { useEffect, useState } from 'react';

import { getTrailStore } from 'TrailStore/TrailStore';
import { MetricsOnboarding } from 'WingmanOnboarding/MetricsOnboarding';

import type { DataTrail } from 'DataTrail';

export default function Trail({ trail }: { trail: DataTrail }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      if (trail.state.metric) {
        getTrailStore().setRecentTrail(trail);
      }
      setIsInitialized(true);
    }

    trail.setState({
      topScene: new MetricsOnboarding(),
    });
  }, [trail, isInitialized]);

  if (!isInitialized) {
    return null;
  }

  return (
    <UrlSyncContextProvider scene={trail}>
      <trail.Component model={trail} />
    </UrlSyncContextProvider>
  );
}
