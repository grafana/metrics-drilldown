import { UrlSyncContextProvider } from '@grafana/scenes';
import React from 'react';

import { type DataTrail } from 'AppDataTrail/DataTrail';

import { useMetricsDrilldownQuestions } from './assistant/questions';

type TrailProps = {
  trail: DataTrail;
};

export default function Trail({ trail }: Readonly<TrailProps>) {
  // Register all assistant questions for metrics drilldown
  // Questions are automatically matched based on URL patterns
  useMetricsDrilldownQuestions();
  

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
