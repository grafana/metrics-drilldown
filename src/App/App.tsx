import { type AppRootProps } from '@grafana/data';
// import { EmbeddedScene, SceneAppPage } from '@grafana/scenes';
import React from 'react';

// import { newMetricsTrail } from 'utils';
// import { prefixRoute } from 'utils/utils.routing';

// import { ROUTES } from '../constants';
// import { DataTrailView } from '../DataTrailsApp';
// import { MetricsExplorerPlugin } from '../DataTrailsAppNew';
// import { makeHomePage } from '../DataTrailsHome';
// import { DataTrailsHome } from '../DataTrailsHome';
import { AppRoutes } from './Routes';
import { PluginPropsContext } from '../utils/utils.plugin';

// const makeHomePage = () => {
//   return new SceneAppPage({
//     title: '', // 'Home' ?
//     url: prefixRoute(ROUTES.Home),
//     getScene: () =>
//       new EmbeddedScene({
//         body: new DataTrailsHome({}),
//       }),
//   });
// };

// const makeTrailPage = () => {
//   return new SceneAppPage({
//     title: '', // 'Trail' ?
//     url: prefixRoute(ROUTES.Trail),
//     getScene: () =>
//       new EmbeddedScene({
//         body: DataTrailView({ trail: newMetricsTrail() }),
//       }),
//   });
// };

// const getSceneApp = () =>
//   new SceneApp({
//     pages: [
//       makeHomePage(),
//       // makeTrailPage()
//     ],
//     urlSyncOptions: {
//       createBrowserHistorySteps: true,
//       updateUrlOnInit: true,
//     },
//   });

// function MetricsExplorationView() {
//   const [isInitialized, setIsInitialized] = useState(false);

//   const scene = useSceneApp(getSceneApp);

//   useEffect(() => {
//     if (!isInitialized) {
//       setIsInitialized(true);
//     }
//   }, [scene, isInitialized]);

//   if (!isInitialized) {
//     return null;
//   }

//   return <scene.Component model={scene} />;
// }

function App(props: AppRootProps) {
  return (
    <PluginPropsContext.Provider value={props}>
      <AppRoutes />
    </PluginPropsContext.Provider>
  );
}

export default App;
