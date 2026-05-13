import { css } from '@emotion/css';
import { type AppRootProps, type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { AppContext, defaultTrail } from './AppContext';
import { AppErrorBoundary } from './AppErrorBoundary';
import { Onboarding } from './Onboarding';
import { AppRoutes } from './Routes';
import { useReportAppInitialized } from './useReportAppInitialized';
import { initOpenFeatureProvider } from '../shared/featureFlags/openFeature';
import { initFaro } from '../shared/logger/faro/faro';
import { isPrometheusDataSource } from '../shared/utils/utils.datasource';
import { PluginPropsContext } from '../shared/utils/utils.plugin';

initFaro();
initOpenFeatureProvider();

const prometheusDatasources = Object.values(config.datasources).filter(isPrometheusDataSource);

export default function App(props: Readonly<AppRootProps>) {
  const styles = useStyles2(getStyles);

  useReportAppInitialized();

  if (!prometheusDatasources.length) {
    return <Onboarding />;
  }

  return (
    <div className={styles.appContainer} data-testid="metrics-drilldown-app">
      <AppErrorBoundary>
        <PluginPropsContext.Provider value={props}>
          <AppContext.Provider value={{ trail: defaultTrail }}>
            <AppRoutes />
          </AppContext.Provider>
        </PluginPropsContext.Provider>
      </AppErrorBoundary>
    </div>
  );
}

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
