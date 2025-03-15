import { registerRuntimeDataSource, type RuntimeDataSource } from '@grafana/scenes';

import { displayError } from './displayStatus';

export function registerRuntimeDataSources(dataSources: RuntimeDataSource[]) {
  try {
    for (const dataSource of dataSources) {
      registerRuntimeDataSource({ dataSource });
    }
  } catch (error) {
    const { message } = error as Error;

    if (!/A runtime data source with uid (.+) has already been registered/.test(message)) {
      displayError(error as Error, [
        'Fail to register all the runtime data sources!',
        'The application cannot work as expected, please try reloading the page or if the problem persists, contact your organization admin.',
      ]);
    }
  }
}
