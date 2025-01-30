import { EmbeddedScene, SceneApp, SceneAppPage, useSceneApp } from '@grafana/scenes';
import React, { useEffect, useState } from 'react';

import { DataTrailsHome } from '../DataTrailsHome';

const makeHomePage = () => {
  return new SceneAppPage({
    title: '',
    url: '/',
    getScene: () =>
      new EmbeddedScene({
        body: new DataTrailsHome({}),
      }),
  });
};

const getSceneApp = () =>
  new SceneApp({
    pages: [makeHomePage()],
    urlSyncOptions: {
      createBrowserHistorySteps: true,
      updateUrlOnInit: true,
    },
  });

function MetricsExplorationView() {
  const [isInitialized, setIsInitialized] = useState(false);

  const scene = useSceneApp(getSceneApp);

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [scene, isInitialized]);

  if (!isInitialized) {
    return null;
  }

  return <scene.Component model={scene} />;
}

export default MetricsExplorationView;
