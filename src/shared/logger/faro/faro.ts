import { ReplayInstrumentation } from '@grafana/faro-instrumentation-replay';
import { getWebInstrumentations, initializeFaro, type Faro } from '@grafana/faro-web-sdk';
import { config } from '@grafana/runtime';

import { getFaroEnvironment } from './getFaroEnvironment';
import { GIT_COMMIT } from '../../../version';
import { PLUGIN_BASE_URL, PLUGIN_ID } from '../../constants/plugin';

let faro: Faro | null = null;

export const getFaro = () => faro;
export const setFaro = (instance: Faro | null) => (faro = instance);

const errorsToIgnore = [
  // Matches core Grafana config (see https://github.com/grafana grafana/pull/54824)
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed',
  'Non-Error exception captured with keys',
  'Failed sending payload to the receiver',
];
const errorsToIgnoreSet = new Set(errorsToIgnore);
/**
 * Determines if an error message is in the list of known non-critical errors that should not be reported to Faro.
 */
export const shouldIgnoreError = (errorMessage: string) => errorsToIgnoreSet.has(errorMessage);

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
      ignoreErrors: errorsToIgnore,
      instrumentations: [
        ...getWebInstrumentations({
          captureConsole: false,
        }),
        new ReplayInstrumentation({
          maskInputOptions: {
            password: true,
            email: true,
            text: true,
            search: true,
            textarea: true,
            select: true,
          },
          maskTextSelector: [
            // Custom data-sensitive attribute for explicitly marked elements
            '[data-sensitive]',
            // PanelChrome panel titles (contains metric names)
            '[class*="panel-title"]',
          ].join(', '),
          maskAllInputs: false,
          recordCrossOriginIframes: false,
          recordCanvas: false,
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
