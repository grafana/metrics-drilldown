import {
  config,
  createOpenFeatureLocalStorageProvider,
  createOpenFeatureOFREPWebProvider,
} from '@grafana/runtime';
import { ClientProviderStatus, MultiProvider, OpenFeature, ProviderEvents } from '@openfeature/web-sdk';

import { evaluateFeatureFlag, initOpenFeatureProvider, OPEN_FEATURE_DOMAIN } from './openFeature';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    config: {
      ...actual.config,
      namespace: 'test-namespace',
      openFeatureContext: {},
      featureToggles: {},
    },
    createOpenFeatureLocalStorageProvider: jest.fn(),
    createOpenFeatureOFREPWebProvider: jest.fn(),
  };
});

jest.mock('@openfeature/web-sdk', () => ({
  ...jest.requireActual('@openfeature/web-sdk'),
  MultiProvider: jest.fn().mockImplementation((providers) => ({ providers })),
  OpenFeature: {
    ...jest.requireActual('@openfeature/web-sdk').OpenFeature,
    getProvider: jest.fn(),
    getClient: jest.fn(),
    setProviderAndWait: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the tracking hook module since it's used in the function under test
jest.mock('./tracking', () => ({
  TrackingHook: jest.fn().mockImplementation(() => ({})),
}));

describe('evaluateFeatureFlag', () => {
  const getStringValue = jest.fn();
  const getBooleanValue = jest.fn();
  const addHandler = jest.fn();
  const addHooks = jest.fn();
  let clientMock: any;

  beforeEach(() => {
    getStringValue.mockReset();
    getBooleanValue.mockReset();
    addHandler.mockReset();
    addHooks.mockReset();

    clientMock = {
      getStringValue,
      getBooleanValue,
      addHandler,
      addHooks,
      providerStatus: ClientProviderStatus.READY,
    };

    (OpenFeature.getClient as jest.Mock).mockReturnValue(clientMock);
  });

  it('correctly evaluates a string flag using the OpenFeature client', async () => {
    // This test verifies that evaluateFeatureFlag correctly delegates to the OpenFeature client
    // and returns the value provided by the client.
    getStringValue.mockReturnValue('treatment');

    // We use a known valid flag for the type check, but the test logic is generic for string flags
    const result = await evaluateFeatureFlag('drilldown.metrics.default_open_sidebar');

    expect(OpenFeature.getClient).toHaveBeenCalledWith(OPEN_FEATURE_DOMAIN);
    expect(addHooks).toHaveBeenCalled(); // Verify hooks are added
    expect(getStringValue).toHaveBeenCalledWith('drilldown.metrics.default_open_sidebar', 'excluded'); // 'excluded' is the default in definition
    expect(result).toBe('treatment');
  });

  it('waits for the OpenFeature client to be ready before evaluating', async () => {
    // This test verifies the "waitForClientReady" wrapper logic
    clientMock.providerStatus = ClientProviderStatus.NOT_READY;
    getStringValue.mockReturnValue('treatment');

    // Simulate event triggering
    addHandler.mockImplementation((event, handler) => {
      if (event === ProviderEvents.Ready) {
        handler(); // Immediately resolve
      }
    });

    await evaluateFeatureFlag('drilldown.metrics.default_open_sidebar');

    expect(addHandler).toHaveBeenCalledWith(ProviderEvents.Ready, expect.any(Function));
    expect(getStringValue).toHaveBeenCalled();
  });

  it('returns the default value from definition when evaluation throws', async () => {
    // This test verifies the error handling wrapper
    getStringValue.mockImplementation(() => {
      throw new Error('network');
    });
    // Suppress console.error for this test case
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // 'excluded' is the default value defined in openFeature.ts for this flag
    await expect(evaluateFeatureFlag('drilldown.metrics.default_open_sidebar')).resolves.toBe('excluded');
  });

  it('evaluates the SLO tracking flag as a boolean with a disabled default', async () => {
    getBooleanValue.mockReturnValue(true);

    const result = await evaluateFeatureFlag('drilldown.metrics.slo_tracked_metrics');

    expect(getBooleanValue).toHaveBeenCalledWith('drilldown.metrics.slo_tracked_metrics', false);
    expect(result).toBe(true);
  });

  it('evaluates the sort_by_firing_alerts A/B test flag as a string with the "excluded" default', async () => {
    getStringValue.mockReturnValue('treatment');

    const result = await evaluateFeatureFlag('drilldown.metrics.sort_by_firing_alerts');

    // 'excluded' is the default value defined in openFeature.ts for this flag
    expect(getStringValue).toHaveBeenCalledWith('drilldown.metrics.sort_by_firing_alerts', 'excluded');
    expect(result).toBe('treatment');
  });

  describe('featureToggle override for string cohort flags', () => {
    afterEach(() => {
      delete (config.featureToggles as Record<string, boolean | undefined>).metricsExploreFireAlerts;
    });

    it('maps an enabled dev feature toggle to the "treatment" cohort', async () => {
      (config.featureToggles as Record<string, boolean | undefined>).metricsExploreFireAlerts = true;

      const result = await evaluateFeatureFlag('drilldown.metrics.sort_by_firing_alerts');

      expect(result).toBe('treatment');
      // The override short-circuits before consulting the OpenFeature client.
      expect(getStringValue).not.toHaveBeenCalled();
    });

    it('maps a disabled dev feature toggle to the "control" cohort', async () => {
      (config.featureToggles as Record<string, boolean | undefined>).metricsExploreFireAlerts = false;

      const result = await evaluateFeatureFlag('drilldown.metrics.sort_by_firing_alerts');

      expect(result).toBe('control');
      expect(getStringValue).not.toHaveBeenCalled();
    });
  });
});

describe('initOpenFeatureProvider', () => {
  const localStorageProvider = { name: 'local-storage-provider' };
  const ofrepProvider = { name: 'ofrep-provider' };

  beforeEach(() => {
    (OpenFeature.setProviderAndWait as jest.Mock).mockResolvedValue(undefined);
    (OpenFeature.getProvider as jest.Mock).mockReturnValue({});
    (MultiProvider as jest.Mock).mockImplementation((providers) => ({ providers }));
    (createOpenFeatureLocalStorageProvider as jest.Mock).mockReturnValue(localStorageProvider);
    (createOpenFeatureOFREPWebProvider as jest.Mock).mockReturnValue(ofrepProvider);
  });

  it('initializes the shared providers as a multi-provider', async () => {
    await initOpenFeatureProvider();

    expect(createOpenFeatureLocalStorageProvider).toHaveBeenCalledTimes(1);
    expect(createOpenFeatureOFREPWebProvider).toHaveBeenCalledTimes(1);
    expect(MultiProvider).toHaveBeenCalledWith([
      { provider: localStorageProvider },
      { provider: ofrepProvider },
    ]);
    expect(OpenFeature.setProviderAndWait).toHaveBeenCalledWith(OPEN_FEATURE_DOMAIN, {
      providers: [{ provider: localStorageProvider }, { provider: ofrepProvider }],
    });
  });

  it('does not initialize when a provider is already registered for the domain', async () => {
    (OpenFeature.getProvider as jest.Mock)
      .mockReturnValueOnce({ name: 'domain-provider' })
      .mockReturnValueOnce({ name: 'default-provider' });

    await initOpenFeatureProvider();

    expect(createOpenFeatureLocalStorageProvider).not.toHaveBeenCalled();
    expect(createOpenFeatureOFREPWebProvider).not.toHaveBeenCalled();
    expect(MultiProvider).not.toHaveBeenCalled();
    expect(OpenFeature.setProviderAndWait).not.toHaveBeenCalled();
  });
});
