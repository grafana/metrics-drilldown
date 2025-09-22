import { config } from '@grafana/runtime';
import { DataSourceVariable } from '@grafana/scenes';

import { VAR_DATASOURCE } from 'shared';
import { logger } from 'tracking/logger/logger';
import { isPrometheusDataSource } from 'utils/utils.datasource';

import { PREF_KEYS } from '../UserPreferences/pref-keys';
import { userStorage } from '../UserPreferences/userStorage';

export class MetricsDrilldownDataSourceVariable extends DataSourceVariable {
  constructor({ initialDS }: { initialDS?: string }) {
    super({
      key: VAR_DATASOURCE,
      name: VAR_DATASOURCE,
      pluginId: 'prometheus',
      label: 'Data source',
      description: 'Only prometheus data sources are supported',
      // if no initialDS is passed to the constructor, we bypass Scenes native behaviour by determining the data source ourselves (see getCurrentDataSource())...
      skipUrlSync: !initialDS,
      // ... by doing this, we make sure that we'll always have a data source when the "var-ds" URL search param is missing, incorrect, etc.
      value: initialDS || MetricsDrilldownDataSourceVariable.getCurrentDataSource(),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.setState({ skipUrlSync: false }); // restore URL sync

    this.subscribeToState((newState, prevState) => {
      if (newState.value && newState.value !== prevState.value) {
        // store the new value for future visits
        userStorage.setItem(PREF_KEYS.DATASOURCE, newState.value as string);
      }
    });
  }

  private static getCurrentDataSource(): string {
    const prometheusDataSources = Object.values(config.datasources).filter((ds) => isPrometheusDataSource(ds));

    const uidFromUrl = new URL(window.location.href).searchParams.get(`var-${VAR_DATASOURCE}`);
    const uidFromLocalStorage = userStorage.getItem(PREF_KEYS.DATASOURCE);

    const currentDataSource =
      prometheusDataSources.find((ds) => ds.uid === uidFromUrl) ||
      prometheusDataSources.find((ds) => ds.uid === uidFromLocalStorage) ||
      prometheusDataSources.find((ds) => ds.isDefault) ||
      prometheusDataSources[0];

    if (!currentDataSource) {
      logger.warn('Cannot find any Prometheus data source!');
      return 'no-data-source-configured';
    }

    return currentDataSource.uid;
  }
}
