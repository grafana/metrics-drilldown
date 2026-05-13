import { t } from '@grafana/i18n';
import { Alert, ErrorBoundary } from '@grafana/ui';
import React from 'react';

import { logger } from '../shared/logger/logger';

interface ExposedComponentErrorBoundaryProps {
  /** Faro boundary name for error attribution (e.g. 'metrics-drilldown-entity-metrics') */
  boundaryName: string;
  /** User-facing component name shown in the error alert (e.g. 'Entity Metrics') */
  componentName: string;
  children: React.ReactNode;
}

function errorLoggerFor(componentName: string) {
  return (error: Error) => {
    logger.error(error, {
      handheldBy: 'exposed-component-error-boundary',
      component: componentName,
    });
  };
}

/**
 * Error boundary for exposed components that mount in host Grafana surfaces
 * (RCA Workbench, Grafana Assistant, etc.) outside the main app React tree.
 *
 * Renders an inline Alert on error instead of the full-page ErrorView,
 * since exposed components are embedded in host contexts where a fatal
 * screen would be inappropriate.
 */
export function ExposedComponentErrorBoundary({
  boundaryName,
  componentName,
  children,
}: Readonly<ExposedComponentErrorBoundaryProps>) {
  return (
    <ErrorBoundary boundaryName={boundaryName} errorLogger={errorLoggerFor(componentName)}>
      {({ error }) => {
        if (error) {
          return (
            <Alert
              severity="error"
              title={t('exposed-component-error-boundary.title', 'Something went wrong')}
            >
              {t(
                'exposed-component-error-boundary.message',
                '{{componentName}} failed to load. Please try again or contact your organization admin.',
                { componentName }
              )}
            </Alert>
          );
        }
        return <>{children}</>;
      }}
    </ErrorBoundary>
  );
}
