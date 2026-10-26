import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceInstanceList } from '@grafana/plugin-compat/datasources';
import { useEffect, useState } from 'react';

import { ensureErrorObject } from 'App/errorUtils';
import { isPrometheusDataSource } from 'shared/utils/utils.datasource';

interface UseDataSourceInstancesState {
  loading: boolean;
  instances: DataSourceInstanceListItem[] | undefined;
  error: Error | undefined;
}

export function useDataSourceInstances(): UseDataSourceInstancesState {
  const [state, setState] = useState<UseDataSourceInstancesState>({
    error: undefined,
    instances: undefined,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    getDataSourceInstanceList({ filter: (ds) => isPrometheusDataSource(ds) })
      .then((instances) => {
        if (cancelled) {
          return;
        }

        setState((prevState) => ({ ...prevState, error: undefined, instances, loading: false }));
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        const defaultErrorMessage = t('shared.hooks.useDataSourceInstances', 'Failed to load data source instances');
        const error = ensureErrorObject(err, defaultErrorMessage);
        setState((prevState) => ({ ...prevState, error, instances: undefined, loading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
