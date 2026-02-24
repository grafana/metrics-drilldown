import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { getAppPluginVersion } from '@grafana/runtime';

import { GIT_COMMIT } from '../../../../version';
import { initFaro, setFaro } from '../faro';

// Faro dependencies
jest.mock('@grafana/faro-web-sdk');

// Grafana dependency
jest.mock('@grafana/runtime', () => ({
  config: {
    bootData: {
      user: {
        email: 'sixty.four@grafana.com',
      },
    },
    buildInfo: {
      version: '11.6.0',
      edition: 'Enterprise',
    },
  },
  getAppPluginVersion: jest.fn().mockResolvedValue('v1-test'),
}));

function setup(location: Partial<Location>) {
  (initializeFaro as jest.Mock).mockReturnValue({});
  (getWebInstrumentations as jest.Mock).mockReturnValue([{}]);
  (getAppPluginVersion as jest.Mock).mockResolvedValue('v1-test');

  Object.defineProperty(window, 'location', {
    value: location,
    writable: true,
  });

  return {
    initializeFaro: initializeFaro as jest.Mock,
  };
}

describe('initFaro()', () => {
  afterEach(() => {
    setFaro(null);
  });

  describe('when running in environment where the host not defined', () => {
    test('does not initialize Faro', async () => {
      const { initializeFaro } = setup({ host: undefined });

      await initFaro();

      expect(initializeFaro).not.toHaveBeenCalled();
    });
  });

  describe('when running in an unknown environment', () => {
    test('does not initialize Faro', async () => {
      const { initializeFaro } = setup({ host: 'unknownhost' });

      await initFaro();

      expect(initializeFaro).not.toHaveBeenCalled();
    });
  });

  describe('when running in an known environment', () => {
    test.each([
      // dev
      [
        'grafana-dev.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/8c57b32175ba39d35dfaccee7cd793c7',
        'grafana-metricsdrilldown-app-dev',
      ],
      [
        'test.grafana-dev.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/8c57b32175ba39d35dfaccee7cd793c7',
        'grafana-metricsdrilldown-app-dev',
      ],
      // ops
      [
        'foobar.grafana-ops.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/d65ab91eb9c5e8c51b474d9313ba28f4',
        'grafana-metricsdrilldown-app-ops',
      ],
      [
        'grafana-ops.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/d65ab91eb9c5e8c51b474d9313ba28f4',
        'grafana-metricsdrilldown-app-ops',
      ],
      // prod
      [
        'foobar.grafana.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/0f4f1bbc97c9e2db4fa85ef75a559885',
        'grafana-metricsdrilldown-app-prod',
      ],
      [
        'grafana.net',
        'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/0f4f1bbc97c9e2db4fa85ef75a559885',
        'grafana-metricsdrilldown-app-prod',
      ],
    ])('initializes Faro for the host "%s"', async (host, faroUrl, appName) => {
      const { initializeFaro } = setup({ host });

      await initFaro();

      expect(initializeFaro).toHaveBeenCalledTimes(1);
      expect(initializeFaro.mock.lastCall[0].url).toBe(faroUrl);
      expect(initializeFaro.mock.lastCall[0].app.name).toBe(appName);
    });

    test('initializes Faro with the proper configuration', async () => {
      const { initializeFaro } = setup({ host: 'grafana.net' });

      await initFaro();

      const { app, user, instrumentations, isolate, beforeSend } = initializeFaro.mock.lastCall[0];

      expect(app).toStrictEqual({
        name: 'grafana-metricsdrilldown-app-prod',
        release: 'v1-test',
        version: GIT_COMMIT,
        environment: 'prod',
      });

      expect(user).toStrictEqual({ email: 'sixty.four@grafana.com' });

      expect(getWebInstrumentations).toHaveBeenCalledWith({
        captureConsole: false,
      });
      expect(instrumentations).toBeInstanceOf(Array);
      expect(instrumentations.length).toBe(1);

      expect(isolate).toBe(true);
      expect(beforeSend).toBeInstanceOf(Function);
    });
  });

  describe('when called several times', () => {
    test('initializes Faro only once', async () => {
      const { initializeFaro } = setup({ host: 'grafana.net' });

      await initFaro();
      await initFaro();

      expect(initializeFaro).toHaveBeenCalledTimes(1);
    });
  });
});
