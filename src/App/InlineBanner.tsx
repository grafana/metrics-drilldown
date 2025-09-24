import { Alert, type AlertVariant } from '@grafana/ui';
import React from 'react';

import { ensureErrorObject } from './useCatchExceptions';
import { logger, type ErrorContext } from '../shared/logger/logger';

type InlineBannerProps = {
  severity: AlertVariant;
  title: string;
  message?: string | React.ReactNode;
  error?: Error;
  errorContext?: ErrorContext;
  children?: React.ReactNode;
};

// adds HTTP status, if available
function formatErrorMessage(error: any) {
  const message = error.message || error.toString();
  const infos = [];
  if (error.statusText) {
    infos.push(error.statusText);
  }
  if (error.status) {
    infos.push(`HTTP ${error.status}`);
  }
  return infos.length ? `${message} (${infos.join(' - ')})` : message;
}

export function InlineBanner({ severity, title, message, error, errorContext, children }: Readonly<InlineBannerProps>) {
  let errorObject;

  if (error) {
    errorObject = ensureErrorObject(error, 'Unknown error!');

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
          {formatErrorMessage(errorObject)}
          <br />
        </>
      )}
      {message}
      {children}
    </Alert>
  );
}
