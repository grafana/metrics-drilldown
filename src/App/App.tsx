import { css } from '@emotion/css';
import { type AppRootProps, type GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import React, { createContext, useEffect, useState } from 'react';

import { type DataTrail } from 'DataTrail';
import { initFaro } from 'tracking/faro/faro';
import { getUrlForTrail, newMetricsTrail } from 'utils';

import { ErrorView } from './ErrorView';
import { AppRoutes } from './Routes';
import { useCatchExceptions } from './useCatchExceptions';
import { PluginPropsContext } from '../utils/utils.plugin';
import { navigationEvents } from '../WingmanDataTrail/SideBar/sections/BookmarksList';

initFaro();

interface MetricsAppContext {
  trail: DataTrail;
  goToUrlForTrail: (trail: DataTrail) => void;
}

export const MetricsContext = createContext<MetricsAppContext>({
  trail: newMetricsTrail(undefined),
  goToUrlForTrail: () => {},
});

function App(props: AppRootProps) {
  const [error] = useCatchExceptions();
  const [trail, setTrail] = useState<DataTrail>(newMetricsTrail(undefined));
  const styles = useStyles2(getStyles);

  const goToUrlForTrail = (trail: DataTrail) => {
    locationService.push(getUrlForTrail(trail));
    setTrail(trail);
  };

  // Subscribe to navigation events from BookmarksList
  useEffect(() => {
    const handleNavigation = (trail: DataTrail) => {
      goToUrlForTrail(trail);
    };

    // Subscribe to navigation events
    const unsubscribe = navigationEvents.subscribe(handleNavigation);

    // Clean up subscription
    return () => unsubscribe();
  }, []);

  if (error) {
    return (
      <div className={styles.appContainer} data-testid="metrics-drilldown-app">
        <ErrorView error={error} />
      </div>
    );
  }

  return (
    <div className={styles.appContainer} data-testid="metrics-drilldown-app">
      <PluginPropsContext.Provider value={props}>
        <MetricsContext.Provider value={{ trail, goToUrlForTrail }}>
          <AppRoutes />
        </MetricsContext.Provider>
      </PluginPropsContext.Provider>
    </div>
  );
}

export default App;

function getStyles(theme: GrafanaTheme2) {
  return {
    appContainer: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: theme.colors.background.primary,
    }),
  };
}
