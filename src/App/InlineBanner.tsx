import { t } from '@grafana/i18n';
import { Alert, type AlertVariant } from '@grafana/ui';
import React, { useEffect, useRef } from 'react';

import { ensureErrorObject } from './errorUtils';
import { logger, type ErrorContext } from '../shared/logger/logger';

type InlineBannerProps = {
  severity: AlertVariant;
  title: string;
  message?: string | React.ReactNode;
  error?: unknown;
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
  const lastReportedError = useRef<unknown>(null);

  useEffect(() => {
    if (error && error !== lastReportedError.current) {
      lastReportedError.current = error;
      const errorObj = ensureErrorObject(error, t('inline-banner.unknown-error', 'Unknown error!'));
      logger.error(errorObj, {
        ...(errorObj.cause || {}),
        ...errorContext,
        bannerTitle: title,
      });
    }
  }, [error, errorContext, title]);

  const errorObject = error ? ensureErrorObject(error, t('inline-banner.unknown-error', 'Unknown error!')) : undefined;

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
