import { css } from '@emotion/css';
import { type AppRootProps, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, useStyles2 } from '@grafana/ui';
import React from 'react';

import { useDataSourceInstances } from 'shared/hooks/useDataSourceInstances';

import { AppContext, defaultTrail } from './AppContext';
import { AppErrorBoundary } from './AppErrorBoundary';
import { Onboarding } from './Onboarding';
import { AppRoutes } from './Routes';
import { useReportAppInitialized } from './useReportAppInitialized';
import { evaluateExperimentFlagsEarly, initOpenFeatureProvider } from '../shared/featureFlags/openFeature';
import { initFaro } from '../shared/logger/faro/faro';
import { PluginPropsContext } from '../shared/utils/utils.plugin';
import { getAppBackgroundColor } from '../shared/utils/utils.styles';

initFaro();
initOpenFeatureProvider().then(evaluateExperimentFlagsEarly);

export default function App(props: Readonly<AppRootProps>) {
  const styles = useStyles2(getStyles);
  const { error, instances, loading } = useDataSourceInstances();

  useReportAppInitialized();

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <Alert
        data-testid="app-error"
        title={t('App.error-title', 'Failed to load data source instances')}
        severity="error"
      >
        {error.message}
      </Alert>
    );
  }

  if (!instances?.length) {
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
      backgroundColor: getAppBackgroundColor(theme),
    }),
  };
}
