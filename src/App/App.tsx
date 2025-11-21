import { css } from '@emotion/css';
import { type AppRootProps, type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { initFaro } from 'shared/logger/faro/faro';

import { AppContext, defaultTrail } from './AppContext';
import { ErrorView } from './ErrorView';
import { Onboarding } from './Onboarding';
import { AppRoutes } from './Routes';
import { useCatchExceptions } from './useCatchExceptions';
import { useReportAppInitialized } from './useReportAppInitialized';
import { isPrometheusDataSource } from '../shared/utils/utils.datasource';
import { PluginPropsContext } from '../shared/utils/utils.plugin';

initFaro();

const prometheusDatasources = Object.values(config.datasources).filter(isPrometheusDataSource);

export default function App(props: Readonly<AppRootProps>) {
  const styles = useStyles2(getStyles);
  const [error] = useCatchExceptions();

  useReportAppInitialized();

  if (error) {
    return (
      <div className={styles.appContainer} data-testid="metrics-drilldown-app">
        <ErrorView error={error} />
      </div>
    );
  }

  if (!prometheusDatasources.length) {
    return <Onboarding />;
  }

  return (
    <div className={styles.appContainer} data-testid="metrics-drilldown-app">
      <PluginPropsContext.Provider value={props}>
        <AppContext.Provider value={{ trail: defaultTrail }}>
          <AppRoutes />
        </AppContext.Provider>
      </PluginPropsContext.Provider>
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
