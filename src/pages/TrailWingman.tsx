import { UrlSyncContextProvider } from '@grafana/scenes';
import React from 'react';

import type { DataTrail } from 'DataTrail';

type TrailProps = {
  trail: DataTrail;
};

export default function Trail({ trail }: Readonly<TrailProps>) {
  return (
    <UrlSyncContextProvider
      scene={trail}
      createBrowserHistorySteps={true}
      updateUrlOnInit={true}
      namespace={trail.state.urlNamespace}
    >
      <trail.Component model={trail} />
    </UrlSyncContextProvider>
  );
}
