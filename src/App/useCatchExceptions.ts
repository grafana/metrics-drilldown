import { useEffect, useState } from 'react';

import { shouldIgnoreError } from '../shared/logger/faro/faro';
import { logger } from '../shared/logger/logger';

export function ensureErrorObject(error: any, defaultMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  if (typeof error.message === 'string') {
    const e = new Error(error.message);
    for (const prop of Object.getOwnPropertyNames(error)) {
      (e as any)[prop] = error[prop];
    }
    return e;
  }
  return new Error(defaultMessage);
}

/**
 * Determines if an error should be treated as an application-breaking error.
 * Filters out known non-critical errors like browser extension errors and ResizeObserver warnings.
 */
function shouldTreatAsApplicationError(errorEvent: ErrorEvent): boolean {
  if (shouldIgnoreError(errorEvent.message)) {
    return false;
  }

  // Add extra context for browser extension errors
  if (errorEvent.filename) {
    const extensionUrl = new URL(errorEvent.filename);

    if (extensionUrl.protocol.endsWith('extension:')) {
      logger.error(new Error(`Browser extension error: ${errorEvent.message}`, { cause: 'browser-extension' }), {
        extensionName: extensionUrl.hostname,
        filename: errorEvent.filename,
        lineno: errorEvent.lineno?.toString(),
        colno: errorEvent.colno?.toString(),
      });
      return false;
    }
  }

  // Add extra context for non-critical errors with a message
  if (errorEvent.error === null && errorEvent.message) {
    logger.error(new Error(`Non-critical error: ${errorEvent.message}`), {
      filename: errorEvent.filename,
      lineno: errorEvent.lineno?.toString(),
      colno: errorEvent.colno?.toString(),
    });
    return false;
  }

  // If it's not one of the special cases above, it's probably a legitimate application error
  return true;
}

export function useCatchExceptions(): [Error | undefined, React.Dispatch<React.SetStateAction<Error | undefined>>] {
  const [error, setError] = useState<Error>();

  // even though we wrap the app in an ErrorBoundary, some errors are not caught,
  // so we have to set global handlers to catch these (e.g. error thrown from some click handlers)
  useEffect(() => {
    const onError = (errorEvent: ErrorEvent) => {
      if (!shouldTreatAsApplicationError(errorEvent)) {
        return;
      }

      setError(ensureErrorObject(errorEvent.error, 'Uncaught exception!'));
    };

    const onUnHandledRejection = (event: PromiseRejectionEvent) => {
      // TODO: remove me when we remove MetricSelectScene
      // indeed, it seems there's always  a cancelled request when landing on the view :man_shrug:
      // Ideally, the code in DataTrail should handle the cancellation but we do it here because it's easier
      // See: https://github.com/grafana/metrics-drilldown/issues/862
      if (event.reason.type === 'cancelled') {
        setError(undefined);
        return;
      }

      setError(ensureErrorObject(event.reason, 'Unhandled rejection!'));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnHandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', onUnHandledRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  return [error, setError];
}
