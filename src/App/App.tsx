import { css } from '@emotion/css';
import { type AppRootProps, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import React, { useMemo } from 'react';

import { useCurrentPrometheusDataSourceUid } from 'shared/hooks/useCurrentPrometheusDataSourceUid';
import { usePrometheusDataSourceInstances } from 'shared/hooks/usePrometheusDataSourceInstances';
import { newMetricsTrail } from 'shared/utils/utils.trail';

import { AppContext } from './AppContext';
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
  const { error: instancesError, instances, loading: instancesLoading } = usePrometheusDataSourceInstances();
  const { error: currentError, uid, loading: currentLoading } = useCurrentPrometheusDataSourceUid(instances);
  const trail = useMemo(() => (uid ? newMetricsTrail({ initialDS: uid }) : undefined), [uid]);

  useReportAppInitialized();

  if (instancesError || currentError) {
    const title = instancesError
      ? t('App.instances-error-title', 'Failed to load data sources')
      : t('App.current-error-title', 'Failed to load current Prometheus data source');

    return (
      <Alert data-testid="app-error" title={title} severity="error">
        {instancesError && instancesError.message}
        {currentError && currentError.message}
      </Alert>
    );
  }

  if (!instancesLoading && !currentLoading && !instances?.length) {
    return <Onboarding />;
  }

  if (instancesLoading || currentLoading || !trail) {
    return <LoadingPlaceholder data-testid="loading-placeholder" text={t('App.loading', 'Loading...')} />;
  }

  return (
    <div className={styles.appContainer} data-testid="metrics-drilldown-app">
      <AppErrorBoundary>
        <PluginPropsContext.Provider value={props}>
          <AppContext.Provider value={{ trail }}>
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
