import { type AppRootProps } from '@grafana/data';
import { EmbeddedScene, SceneApp, SceneAppPage, useSceneApp } from '@grafana/scenes';
import React, { useEffect, useState } from 'react';

import { newMetricsTrail } from 'utils';
import { prefixRoute } from 'utils/utils.routing';

import { ROUTES } from '../constants';
// import { makeHomePage } from '../DataTrailsHome';
import { DataTrailView } from '../DataTrailsApp';
import { DataTrailsHome } from '../DataTrailsHome';
import { PluginPropsContext } from '../utils/utils.plugin';

const makeHomePage = () => {
  return new SceneAppPage({
    title: '', // 'Home' ?
    url: prefixRoute(ROUTES.Home),
    getScene: () =>
      new EmbeddedScene({
        body: new DataTrailsHome({}),
      }),
  });
};

const makeTrailPage = () => {
  return new SceneAppPage({
    title: '', // 'Trail' ?
    url: prefixRoute(ROUTES.Trail),
    getScene: () =>
      new EmbeddedScene({
        body: DataTrailView({ trail: newMetricsTrail() }),
      }),
  });
};

const getSceneApp = () =>
  new SceneApp({
    pages: [makeHomePage(), makeTrailPage()],
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

function App(props: AppRootProps) {
  return (
    <PluginPropsContext.Provider value={props}>
      <MetricsExplorationView />
    </PluginPropsContext.Provider>
  );
}

export default App;
