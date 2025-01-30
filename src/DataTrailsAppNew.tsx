// import { css } from '@emotion/css';

import { PageLayoutType } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { EmbeddedScene, SceneApp, SceneAppPage, SceneObjectBase, useSceneApp } from '@grafana/scenes';
// import { useStyles2 } from '@grafana/ui';
import React from 'react';
// import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';

import { prefixRoute } from 'utils/utils.routing';

import { ROUTES } from './constants';
import { DataTrail } from './DataTrail';
import { DataTrailsHome } from './DataTrailsHome';
import { RefreshMetricsEvent } from './shared';
// import { getTrailStore } from './TrailStore/TrailStore';
import { getUrlForTrail, newMetricsTrail } from './utils';
import { ScopesFacade } from './utils/utils.scopes';

interface MetricsAppContext {
  trail: DataTrail;
  home: DataTrailsHome;
}

// function DataTrailView({ trail }: { trail: DataTrail }) {
//   // const styles = useStyles2(getStyles);
//   // const { metric } = trail.useState();

//   useEffect(() => {
//     getTrailStore().setRecentTrail(trail);
//   }, [trail]);

//   const trailPage = new SceneAppPage({
//     title: 'Metrics Trail',
//     layout: PageLayoutType.Custom,
//     url: prefixRoute(ROUTES.Trail),
//     getScene: () => {
//       return new EmbeddedScene({
//         body: trail,
//       });
//     },
//   });

//   return trailPage;
// }

// const getStyles = () => ({
//   topNavContainer: css({
//     width: '100%',
//     height: '100%',
//     display: 'flex',
//     flexDirection: 'row',
//     justifyItems: 'flex-start',
//   }),
// });

/**
 * Creates and returns a configured SceneApp instance for the Metrics Explorer
 */
export function getMetricsSceneApp() {
  // @ts-expect-error
  const $behaviors = config.featureToggles.enableScopesInMetricsExplore
    ? [
        new ScopesFacade({
          handler: (facade) => {
            const trail = facade.parent && 'trail' in facade.parent.state ? facade.parent.state.trail : undefined;

            if (trail instanceof DataTrail) {
              trail.publishEvent(new RefreshMetricsEvent());
              trail.checkDataSourceForOTelResources();
            }
          },
        }),
      ]
    : undefined;

  const trail = newMetricsTrail(undefined, true);

  const navigateToTrail = (newTrail: DataTrail) => {
    appContext.trail = newTrail;
    locationService.push(getUrlForTrail(newTrail));
  };

  const appContext: MetricsAppContext = {
    trail,
    home: new DataTrailsHome({
      onTrailSelected: navigateToTrail,
    }),
  };

  // Home page
  const homePage = new SceneAppPage({
    title: '',
    url: prefixRoute(ROUTES.Home),
    layout: PageLayoutType.Standard,
    getScene: () =>
      new EmbeddedScene({
        body: appContext.home,
      }),
  });

  // Trail view page
  const trailPage = new SceneAppPage({
    title: 'Metrics Trail',
    layout: PageLayoutType.Custom,
    routePath: prefixRoute(ROUTES.Trail),
    url: prefixRoute(ROUTES.Trail),
    getScene: () => {
      return new EmbeddedScene({
        body: appContext.trail,
      });
    },
  });
  console.log('Trail page URL:', prefixRoute(ROUTES.Trail));

  const testPage = new SceneAppPage({
    title: 'Test Page',
    layout: PageLayoutType.Standard,
    url: prefixRoute(ROUTES.Test),
    getScene: () =>
      new EmbeddedScene({
        body: new TestPage(),
      }),
  });

  return new SceneApp({
    pages: [homePage, trailPage, testPage],
    $behaviors,
    urlSyncOptions: {
      updateUrlOnInit: true,
      createBrowserHistorySteps: true,
    },
  });
}

/**
 * Main plugin component that renders the Metrics Explorer app
 */
export function MetricsExplorerPlugin() {
  const scene = useSceneApp(getMetricsSceneApp);
  return <scene.Component model={scene} />;
}

class TestPage extends SceneObjectBase<{}> {
  constructor() {
    super({});
  }

  static Component = () => {
    return <div>Test page content</div>;
  };
}
