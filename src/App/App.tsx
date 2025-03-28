import { css } from '@emotion/css';
import { type AppRootProps, type GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ErrorBoundary, useStyles2 } from '@grafana/ui';
import React, { createContext, useState } from 'react';

import { type DataTrail } from 'DataTrail';
import { initFaro } from 'tracking/faro/faro';
import { getUrlForTrail, newMetricsTrail } from 'utils';

import { ErrorView } from './ErrorView';
import { AppRoutes } from './Routes';
import { PluginPropsContext } from '../utils/utils.plugin';

initFaro();

interface MetricsAppContext {
  trail: DataTrail;
  goToUrlForTrail: (trail: DataTrail) => void;
}

export const MetricsContext = createContext<MetricsAppContext>({
  trail: newMetricsTrail(undefined, true),
  goToUrlForTrail: () => {},
});

function App(props: AppRootProps) {
  const [trail, setTrail] = useState<DataTrail>(newMetricsTrail(undefined, true));
  const styles = useStyles2(getStyles);
  const goToUrlForTrail = (trail: DataTrail) => {
    locationService.push(getUrlForTrail(trail));
    setTrail(trail);
  };

  const [error, setError] = useState<Error>();
  if (error) {
    return (
      <div className={styles.appContainer} data-testid="metrics-drilldown-app">
        <ErrorView error={error} />
      </div>
    );
  }

  return (
    <div className={styles.appContainer} data-testid="metrics-drilldown-app">
      <ErrorBoundary onError={setError}>
        {() => (
          <PluginPropsContext.Provider value={props}>
            <MetricsContext.Provider value={{ trail, goToUrlForTrail }}>
              <AppRoutes />
            </MetricsContext.Provider>
          </PluginPropsContext.Provider>
        )}
      </ErrorBoundary>
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
