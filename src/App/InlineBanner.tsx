import { Alert, type AlertVariant } from '@grafana/ui';
import React from 'react';

import { logger, type ErrorContext } from '../tracking/logger/logger';

type InlineBannerProps = {
  severity: AlertVariant;
  title: string;
  message?: string | React.ReactNode;
  error?: Error;
  errorContext?: ErrorContext;
};

export function InlineBanner({ severity, title, message, error, errorContext }: InlineBannerProps) {
  if (error) {
    logger.error(error, errorContext);
  }

  return (
    <Alert title={title} severity={severity}>
      {error && (
        <>
          {error.message}
          <br />
        </>
      )}
      {message}
    </Alert>
  );
}
