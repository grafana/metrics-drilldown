import { css } from '@emotion/css';
import { type AppRootProps, type GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import React, { createContext, useState } from 'react';

import { type DataTrail } from 'DataTrail';
import { getUrlForTrail, newMetricsTrail } from 'utils';

import { AppRoutes } from './Routes';
import { PluginPropsContext } from '../utils/utils.plugin';

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

  return (
    <div className={styles.appContainer}>
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
      backgroundColor: theme.colors.background.primary,
    }),
  };
}
