import { css } from '@emotion/css';
import { type AppRootProps, type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { initFaro } from 'tracking/faro/faro';
import { logger } from 'tracking/logger/logger';
import { userPreferences } from 'UserPreferences/userPreferences';

import { ErrorView } from './ErrorView';
import { Onboarding } from './Onboarding';
import { AppRoutes } from './Routes';
import { useCatchExceptions } from './useCatchExceptions';
import { useReportAppInitialized } from './useReportAppInitialized';
import { MetricsContext, useTrail } from './useTrail';
import { isPrometheusDataSource } from '../utils/utils.datasource';
import { PluginPropsContext } from '../utils/utils.plugin';

initFaro();

const prometheusDatasources = Object.values(config.datasources).filter(isPrometheusDataSource);

try {
  userPreferences.migrate();
} catch (error) {
  logger.error(error as Error, { cause: 'User preferences migration' });
}

export default function App(props: Readonly<AppRootProps>) {
  const styles = useStyles2(getStyles);
  const [error] = useCatchExceptions();
  const { trail, goToUrlForTrail } = useTrail();

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
        <MetricsContext.Provider value={{ trail, goToUrlForTrail }}>
          <AppRoutes />
        </MetricsContext.Provider>
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
