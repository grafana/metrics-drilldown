import { getWebInstrumentations, initializeFaro, type Faro } from '@grafana/faro-web-sdk';
import { config } from '@grafana/runtime';

import { getFaroEnvironment } from './getFaroEnvironment';
import { GIT_COMMIT } from '../../../version';
import { PLUGIN_BASE_URL } from '../../constants/plugin';
import { getPluginVersion } from '../../utils/getPluginVersion';

let faro: Faro | null = null;

export const getFaro = () => faro;
export const setFaro = (instance: Faro | null) => (faro = instance);

export const ignoreErrorPatterns: Array<string | RegExp> = [
  /^ResizeObserver loop/,
  /^Non-Error exception captured with keys/,
  /^Failed sending payload to the receiver/,
  /chrome-extension:\/\//,
  /moz-extension:\/\//,
  /^Looks like there is an error in the background page/,
  /^cancelled$/,
];

export async function initFaro() {
  if (getFaro()) {
    return;
  }

  const faroEnvironment = getFaroEnvironment();
  if (!faroEnvironment) {
    return;
  }

  const { environment, faroUrl, appName } = faroEnvironment;
  const appRelease = await getPluginVersion();
  const { bootData } = config;
  const userEmail = bootData.user.email;

  setFaro(
    initializeFaro({
      url: faroUrl,
      app: {
        name: appName,
        release: appRelease ?? undefined,
        version: GIT_COMMIT,
        environment,
      },
      user: {
        email: userEmail,
      },
      ignoreErrors: ignoreErrorPatterns,
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
