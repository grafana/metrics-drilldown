import { useEffect, useState } from 'react';

function ensureErrorObject(error: any, defaultMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  if (typeof error.message === 'string') {
    return new Error(error.message);
  }
  return new Error(defaultMessage);
}

export function useCatchExceptions(): [Error | undefined, React.Dispatch<React.SetStateAction<Error | undefined>>] {
  const [error, setError] = useState<Error>();

  // even though we wrap the app in an ErrorBoundary, some errors are not caught,
  // so we have to set global handlers to catch these (e.g. error thrown from some click handlers)
  useEffect(() => {
    const onError = (errorEvent: ErrorEvent) => {
      // TODO: remove me when move all the variables from the DataTrail Scene object to the WingMan Scene objects
      // this happens because we add the variables to DataTrail without register WingMan's runtime data sources
      if (['Datasource grafana-prometheus-labels-datasource was not found'].includes(errorEvent.error.message)) {
        setError(undefined);
        return;
      }

      setError(ensureErrorObject(errorEvent.error, 'Uncaught exception!'));
    };

    const onUnHandledRejection = (event: PromiseRejectionEvent) => {
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
