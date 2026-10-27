import { t } from '@grafana/i18n';
import { DataSourceVariable } from '@grafana/scenes';

import { VAR_DATASOURCE } from 'shared/shared';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';

export class MetricsDrilldownDataSourceVariable extends DataSourceVariable {
  constructor({ initialDS, skipUrlSync }: { initialDS: string; skipUrlSync: boolean }) {
    super({
      key: VAR_DATASOURCE,
      name: VAR_DATASOURCE,
      pluginId: 'prometheus',
      label: t('data-source-variable.label', 'Data source'),
      description: t('data-source-variable.description', 'Only prometheus data sources are supported'),
      // Standalone selection is already validated before the initial URL sync.
      skipUrlSync,
      value: initialDS,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.setState({ skipUrlSync: false }); // restore URL sync

    this.subscribeToState((newState, prevState) => {
      if (newState.value && newState.value !== prevState.value) {
        reportExploreMetrics('datasource_changed', {});
        // store the new value for future visits
        userStorage.setItem(PREF_KEYS.DATASOURCE, newState.value as string);
      }
    });
  }
}
