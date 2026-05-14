import { ErrorBoundary } from '@grafana/ui';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { ErrorView } from './ErrorView';
import { logger } from '../shared/logger/logger';

function errorLogger(error: Error): void {
  logger.error(error, {
    handledBy: 'trail-error-boundary',
  });
}

/**
 * Route-level error boundary that wraps the trail scene content.
 *
 * Sits inside PluginPage so the page chrome (breadcrumbs, header) remains
 * visible when a scene crashes. The user can still navigate away via
 * breadcrumbs to recover.
 *
 * ChunkLoadError recovery is intentionally NOT handled here — those errors
 * propagate to AppErrorBoundary at the app root for soft-reload handling.
 */
export function TrailErrorBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary boundaryName="metrics-drilldown-trail" errorLogger={errorLogger} dependencies={[pathname]}>
      {({ error }) => {
        if (error) {
          return <ErrorView error={error} />;
        }
        return <>{children}</>;
      }}
    </ErrorBoundary>
  );
}
