import { Alert, type AlertVariant } from '@grafana/ui';
import React from 'react';

import { logger, type ErrorContext } from '../tracking/logger/logger';

type InlineBannerProps = {
  severity: AlertVariant;
  title: string;
  message?: string | React.ReactNode;
  error?: Error;
  errorContext?: ErrorContext;
  children?: React.ReactNode;
};

export function InlineBanner({ severity, title, message, error, errorContext, children }: InlineBannerProps) {
  let errorObject;

  if (error) {
    errorObject = error instanceof Error ? error : new Error(error);

    logger.error(errorObject, {
      ...(errorObject.cause || {}),
      ...errorContext,
      bannerTitle: title,
    });
  }

  return (
    <Alert title={title} severity={severity}>
      {errorObject && (
        <>
          {errorObject.message}
          <br />
        </>
      )}
      {message}
      {children}
    </Alert>
  );
}
