import { getWebInstrumentations, initializeFaro, type Faro } from '@grafana/faro-web-sdk';
import { config } from '@grafana/runtime';

import { getFaroEnvironment } from './getFaroEnvironment';
import { GIT_COMMIT } from '../../../version';
import { PLUGIN_BASE_URL, PLUGIN_ID } from '../../constants/plugin';

let faro: Faro | null = null;

export const getFaro = () => faro;
export const setFaro = (instance: Faro | null) => (faro = instance);

export function initFaro() {
  if (getFaro()) {
    return;
  }

  const faroEnvironment = getFaroEnvironment();
  if (!faroEnvironment) {
    return;
  }

  const { environment, faroUrl, appName } = faroEnvironment;
  const { apps, bootData } = config;
  const appRelease = apps[PLUGIN_ID].version;
  const userEmail = bootData.user.email;

  setFaro(
    initializeFaro({
      url: faroUrl,
      app: {
        name: appName,
        release: appRelease,
        version: GIT_COMMIT,
        environment,
      },
      user: {
        email: userEmail,
      },
      instrumentations: [
        ...getWebInstrumentations({
          captureConsole: false,
        }),
      ],
      isolate: true,
      beforeSend: (event) => {
        if ((event.meta.page?.url ?? '').includes(PLUGIN_BASE_URL)) {
          return event;
        }

        return null;
      },
    })
  );
}
