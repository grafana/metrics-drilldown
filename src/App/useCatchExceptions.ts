import { isObject } from '@grafana/data';
import { useEffect, useState } from 'react';

import { shouldIgnoreError } from '../shared/logger/faro/faro';
import { logger } from '../shared/logger/logger';

/**
 * Check if input is an object with a string 'message' property.
 */
function isObjectWithStringProperty<T extends Record<string, unknown>>(
  object: T,
  propertyName: keyof T
): object is T & { [propertyName]: string } {
  return isObject(object) && propertyName in object && typeof object[propertyName] === 'string';
}

export function ensureErrorObject(error: any, defaultMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  if (isObjectWithStringProperty(error, 'message')) {
    return new Error(error.message);
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

      setError(ensureErrorObject(errorEvent.error ?? errorEvent, 'Uncaught exception!'));
    };

    const onUnHandledRejection = (event: PromiseRejectionEvent) => {
      // TODO: remove me when we remove MetricSelectScene
      // indeed, it seems there's always  a cancelled request when landing on the view :man_shrug:
      // Ideally, the code in DataTrail should handle the cancellation but we do it here because it's easier
      if (isObjectWithStringProperty(event.reason, 'type') && event.reason.type === 'cancelled') {
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
