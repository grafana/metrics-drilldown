import { UrlSyncContextProvider } from '@grafana/scenes';
import React, { useEffect, useState } from 'react';

import { getTrailStore } from 'TrailStore/TrailStore';

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
  }, [trail, isInitialized]);

  if (!isInitialized) {
    return null;
  }

  return (
    <UrlSyncContextProvider scene={trail} createBrowserHistorySteps={true} updateUrlOnInit={true}>
      <trail.Component model={trail} />
    </UrlSyncContextProvider>
  );
}
