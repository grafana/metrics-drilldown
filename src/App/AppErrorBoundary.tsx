import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, ErrorBoundary, useStyles2 } from '@grafana/ui';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { ErrorView } from './ErrorView';
import { logger } from '../shared/logger/logger';

const CHUNK_RELOAD_KEY = 'mdrilldown:chunk-reload-attempted';

export function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk .* failed/i.test(error.message) ||
    /Failed to fetch dynamically imported module/i.test(error.message)
  );
}

function errorLogger(error: Error): void {
  logger.error(error, {
    handheldBy: isChunkLoadError(error) ? 'chunk-load-recovery' : 'React error boundary',
  });
}

function ChunkLoadRecovery() {
  const styles = useStyles2(getStyles);
  const alreadyAttempted = sessionStorage.getItem(CHUNK_RELOAD_KEY) === 'true';

  useEffect(() => {
    if (!alreadyAttempted) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
      const timer = setTimeout(() => window.location.reload(), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [alreadyAttempted]);

  if (alreadyAttempted) {
    return (
      <div className={styles.container}>
        <p>
          <Trans i18nKey="chunk-load-recovery.manual-message">
            A newer version of Metrics Drilldown is available but could not be loaded automatically.
          </Trans>
        </p>
        <Button onClick={() => window.location.reload()}>
          {t('chunk-load-recovery.reload-button', 'Reload now')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <p>
        <Trans i18nKey="chunk-load-recovery.auto-message">
          A newer version of Metrics Drilldown is available — reloading…
        </Trans>
      </p>
    </div>
  );
}

function SuccessfulMount({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  }, []);
  return <>{children}</>;
}

export function AppErrorBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary boundaryName="metrics-drilldown-app" errorLogger={errorLogger} dependencies={[pathname]}>
      {({ error }) => {
        if (error) {
          if (isChunkLoadError(error)) {
            return <ChunkLoadRecovery />;
          }
          return <ErrorView error={error} />;
        }
        return <SuccessfulMount>{children}</SuccessfulMount>;
      }}
    </ErrorBoundary>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(4),
      textAlign: 'center',
    }),
  };
}
