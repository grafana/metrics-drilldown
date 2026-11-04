import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useEffect, useState } from 'react';

import { ensureErrorObject } from 'App/errorUtils';
import { getCurrentPrometheusDataSource } from 'shared/utils/utils.datasource';

interface State {
  loading: boolean;
  uid: string | undefined;
  error: Error | undefined;
  instances?: DataSourceInstanceListItem[];
}

export function useCurrentPrometheusDataSourceUid(instances?: DataSourceInstanceListItem[]): State {
  const [state, setState] = useState<State>({
    error: undefined,
    uid: undefined,
    loading: true,
  });

  useEffect(() => {
    if (instances === undefined) {
      return;
    }

    const currentInstances = instances;
    let cancelled = false;

    async function resolveUid() {
      try {
        const uid = await getCurrentPrometheusDataSource(currentInstances);
        if (cancelled) {
          return;
        }

        setState({ instances: currentInstances, loading: false, uid, error: undefined });
      } catch (err) {
        if (cancelled) {
          return;
        }

        const defaultErrorMessage = t(
          'shared.hooks.useCurrentPrometheusDataSourceUid',
          'Failed to get current Prometheus data source uid'
        );
        const error = ensureErrorObject(err, defaultErrorMessage);
        setState({ instances: currentInstances, loading: false, uid: undefined, error });
      }
    }

    void resolveUid();

    return () => {
      cancelled = true;
    };
  }, [instances]);

  if (instances === undefined || state.instances !== instances) {
    return { loading: true, uid: undefined, error: undefined };
  }

  return { loading: state.loading, uid: state.uid, error: state.error };
}
