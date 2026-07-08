import { sceneGraph, type CustomVariable, type QueryVariable } from '@grafana/scenes';

import { evaluateFeatureFlag } from 'shared/featureFlags/openFeature';

import { MetricsVariableSortEngine } from '../../../metrics-variables/MetricsVariableSortEngine';
import { MetricsSorter, VAR_WINGMAN_SORT_BY } from '../MetricsSorter';

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('shared/featureFlags/openFeature', () => ({
  evaluateFeatureFlag: jest.fn(),
}));

jest.mock('../fetchers/fetchFiringAlertMetrics', () => ({
  fetchFiringAlertMetrics: jest.fn(),
}));

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: {
      ...actual.sceneGraph,
      getVariables: jest.fn(),
      findByKeyAndType: jest.fn(),
    },
  };
});

const mockEvaluateFeatureFlag = evaluateFeatureFlag as jest.MockedFunction<typeof evaluateFeatureFlag>;
const mockGetVariables = sceneGraph.getVariables as jest.MockedFunction<typeof sceneGraph.getVariables>;
const mockFindByKeyAndType = sceneGraph.findByKeyAndType as jest.Mock;

// =============================================================================
// HELPERS
// =============================================================================

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createSorterAndVar(): { sorter: MetricsSorter; sortByVar: CustomVariable } {
  const sorter = new MetricsSorter({});
  const sortByVar = sorter.state.$variables.getByName(VAR_WINGMAN_SORT_BY) as CustomVariable;

  mockGetVariables.mockReturnValue(sorter.state.$variables);

  return { sorter, sortByVar };
}

// =============================================================================
// TESTS
// =============================================================================

describe('MetricsSorter — Firing Alerts sort option', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('feature flag enabled', () => {
    beforeEach(() => {
      mockEvaluateFeatureFlag.mockResolvedValue(true);
    });

    it('adds "firing-alerts" to supported options and variable query', async () => {
      const { sorter, sortByVar } = createSorterAndVar();

      // Invoke activation handler directly to avoid CustomVariable self-activation
      (sorter as any).activationHandler();
      await flushPromises();

      expect(sorter.supportedSortByOptions.has('firing-alerts')).toBe(true);
      expect(sortByVar.state.query).toContain('firing-alerts');
    });

    it('preserves sortBy=firing-alerts when the flag is on', async () => {
      const { sorter, sortByVar } = createSorterAndVar();
      sortByVar.setState({ value: 'firing-alerts' });

      (sorter as any).activationHandler();
      await flushPromises();

      expect(sortByVar.state.value).toBe('firing-alerts');
    });
  });

  describe('feature flag disabled', () => {
    beforeEach(() => {
      mockEvaluateFeatureFlag.mockResolvedValue(false);
    });

    it('does not add "firing-alerts" to supported options or variable query', async () => {
      const { sorter, sortByVar } = createSorterAndVar();

      (sorter as any).activationHandler();
      await flushPromises();

      expect(sorter.supportedSortByOptions.has('firing-alerts')).toBe(false);
      expect(sortByVar.state.query).not.toContain('firing-alerts');
    });

    it('migrates sortBy=firing-alerts to default', async () => {
      const { sorter, sortByVar } = createSorterAndVar();
      sortByVar.setState({ value: 'firing-alerts' });

      (sorter as any).activationHandler();
      await flushPromises();

      expect(sortByVar.state.value).toBe('default');
    });
  });
});

describe('MetricsVariableSortEngine — sortByFiringAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sorts metrics by firing alert count descending, with alphabetical tiebreak', async () => {
    const options = [
      { label: 'cpu_usage', value: 'cpu_usage' },
      { label: 'http_requests_total', value: 'http_requests_total' },
      { label: 'memory_usage', value: 'memory_usage' },
      { label: 'disk_io', value: 'disk_io' },
    ];

    const setState = jest.fn();
    const publishEvent = jest.fn();
    const mockVariable = {
      state: { options },
      setState,
      publishEvent,
    } as unknown as QueryVariable;

    const firingCounts: Record<string, number> = {
      http_requests_total: 5,
      memory_usage: 3,
      cpu_usage: 3, // tie with memory_usage — alphabetical wins
      disk_io: 0,
    };

    mockFindByKeyAndType.mockReturnValue({
      getFiringAlertCountsAsRecord: jest.fn().mockResolvedValue(firingCounts),
    });

    const engine = new MetricsVariableSortEngine(mockVariable);
    await engine.sort('firing-alerts');

    expect(setState).toHaveBeenCalledWith({
      options: [
        { label: 'http_requests_total', value: 'http_requests_total' },
        { label: 'cpu_usage', value: 'cpu_usage' },
        { label: 'memory_usage', value: 'memory_usage' },
        { label: 'disk_io', value: 'disk_io' },
      ],
    });
  });
});
