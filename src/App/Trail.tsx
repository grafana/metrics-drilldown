import { PageLayoutType, type NavModelItem } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { UrlSyncContextProvider } from '@grafana/scenes';
import React from 'react';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { MetricScene } from 'MetricScene/MetricScene';

type TrailProps = {
  trail: DataTrail;
};

export default function Trail({ trail }: Readonly<TrailProps>) {
  const { topScene, metric } = trail.useState();

  let pageNav: NavModelItem | undefined = undefined;

  if (metric && topScene instanceof MetricScene) {
    pageNav = {
      text: metric, // add selected metric name to navigation breadcrumbs
      url: window.location.pathname + window.location.search,
      parentItem: {
        text: 'Metrics',
        url: window.location.pathname,
      },
    };
  }

  return (
    <PluginPage pageNav={pageNav} layout={PageLayoutType.Canvas}>
      <UrlSyncContextProvider
        scene={trail}
        createBrowserHistorySteps={true}
        updateUrlOnInit={true}
        namespace={trail.state.urlNamespace}
      >
        <trail.Component model={trail} />
      </UrlSyncContextProvider>
    </PluginPage>
  );
}
