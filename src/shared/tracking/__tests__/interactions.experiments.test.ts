import { getTrackedFlagPayload } from '../../featureFlags/tracking';

import type * as InteractionsModule from '../interactions';

// interactions.ts imports reportInteraction and (transitively, via getPluginVersion) reads config at module
// load; keep both mocked so requiring the real module is cheap and doesn't crash on startup.
jest.mock('@grafana/runtime', () => ({
  reportInteraction: jest.fn(),
  config: { apps: {} },
}));

jest.mock('../../featureFlags/tracking', () => ({
  getTrackedFlagPayload: jest.fn(),
}));

// jest.config.js maps every "*/interactions" import to a no-op mock (regex `^.+/interactions$`). The explicit
// `.ts` extension dodges that mapper so we load the real module and exercise the real enrichment logic.
// getExperimentPayloads is a pure function, so we can assert on its return directly without going through
// reportInteraction (which would pull in the real @grafana/runtime).
const { getExperimentPayloads } = jest.requireActual('../interactions.ts') as typeof InteractionsModule;

const mockGetTrackedFlagPayload = getTrackedFlagPayload as jest.Mock;

const FIRING_ALERTS_KEY = 'experiment_sort_by_firing_alerts';
const COHORT = { [FIRING_ALERTS_KEY]: 'control' };

describe('getExperimentPayloads — sort-by-firing-alerts experiment enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate the flag having been evaluated: the cohort is available for the firing-alerts tracking key only.
    mockGetTrackedFlagPayload.mockImplementation((key: string) => (key === FIRING_ALERTS_KEY ? COHORT : null));
  });

  it('enriches metric_selected (the both-arms primary KPI) with the cohort', () => {
    const payload = getExperimentPayloads('metric_selected', { from: 'metric_list', searchTermCount: null });

    expect(payload).toMatchObject(COHORT);
    expect(mockGetTrackedFlagPayload).toHaveBeenCalledWith(FIRING_ALERTS_KEY, true);
  });

  it('enriches the firing-alert adoption/guardrail events with the cohort', () => {
    expect(getExperimentPayloads('firing_alert_filter_toggled', { action: 'activated', matching_count: 3 })).toMatchObject(
      COHORT
    );
    expect(
      getExperimentPayloads('firing_alert_metrics_fetched', {
        status: 'success',
        duration_ms: 10,
        metric_count: 2,
        rule_count: 4,
      })
    ).toMatchObject(COHORT);
  });

  it('enriches sorting_changed only when the firing-alerts sort is selected from the metrics reducer', () => {
    expect(getExperimentPayloads('sorting_changed', { from: 'metrics-reducer', sortBy: 'firing-alerts' })).toMatchObject(
      COHORT
    );

    const otherSort = getExperimentPayloads('sorting_changed', { from: 'metrics-reducer', sortBy: 'alphabetical' });
    expect(otherSort[FIRING_ALERTS_KEY]).toBeUndefined();
  });

  it('does not enrich unrelated events with the cohort', () => {
    expect(getExperimentPayloads('quick_search_used', {})[FIRING_ALERTS_KEY]).toBeUndefined();
  });

  it('omits the cohort when it has not been recorded yet (null payload)', () => {
    mockGetTrackedFlagPayload.mockReturnValue(null);

    expect(getExperimentPayloads('metric_selected', { from: 'metric_list', searchTermCount: null })[FIRING_ALERTS_KEY]).toBeUndefined();
  });
});
