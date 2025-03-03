import { css } from '@emotion/css';
import { type AppRootProps, type GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import React, { createContext, useState } from 'react';

import { type DataTrail } from 'DataTrail';
import { getUrlForTrail, newMetricsTrail } from 'utils';
import { type WingmanDataTrail } from 'WingmanDataTrail';

import { AppRoutes } from './Routes';
import { PluginPropsContext } from '../utils/utils.plugin';

interface MetricsAppContext {
  trail: DataTrail | WingmanDataTrail;
  goToUrlForTrail: (trail: DataTrail) => void;
}

export const MetricsContext = createContext<MetricsAppContext>({
  trail: newMetricsTrail(undefined, true),
  goToUrlForTrail: () => {},
});

function App(props: AppRootProps) {
  const [trail, setTrail] = useState<DataTrail | WingmanDataTrail>(newMetricsTrail(undefined, true));
  const styles = useStyles2(getStyles);
  const goToUrlForTrail = (trail: DataTrail | WingmanDataTrail) => {
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
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh', // Ensure full page height
      backgroundColor: theme.colors.background.primary,
    }),
  };
}
