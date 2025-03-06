import { registerRuntimeDataSource } from '@grafana/scenes';

import { displayError } from './helpers/displayStatus';
import { LabelsDataSource } from './Labels/LabelsDataSource';

export function registerRuntimeDataSources() {
  try {
    registerRuntimeDataSource({ dataSource: new LabelsDataSource() });
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
