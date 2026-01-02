import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import { logger } from 'shared/logger/logger';

export function displayError(error: Error, msgs: Array<string | React.ReactElement>) {
  const context = msgs.reduce((acc, msg, i) => ({ ...acc, [`info${i + 1}`]: msg }), { handheldBy: 'displayError' });

  logger.error(error, context);

  const appEvents = getAppEvents();
  if (appEvents) {
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: msgs,
    });
  }
}

export function displayWarning(msgs: Array<string | React.ReactElement>) {
  logger.warn(msgs);

  const appEvents = getAppEvents();
  if (appEvents) {
    appEvents.publish({
      type: AppEvents.alertWarning.name,
      payload: msgs,
    });
  }
}

export function displaySuccess(msgs: Array<string | React.ReactElement>) {
  const appEvents = getAppEvents();
  if (appEvents) {
    appEvents.publish({
      type: AppEvents.alertSuccess.name,
      payload: msgs,
    });
  }
}
