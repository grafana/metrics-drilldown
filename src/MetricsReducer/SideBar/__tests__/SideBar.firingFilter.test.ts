import { sceneGraph } from '@grafana/scenes';

import { evaluateFeatureFlag, isFiringAlertsSortingEnabled } from 'shared/featureFlags/openFeature';

import { FiringAlertChip } from '../../list-controls/FiringAlertChip/FiringAlertChip';
import { VAR_FILTERED_METRICS_VARIABLE } from '../../metrics-variables/FilteredMetricsVariable';
import { type MetricsFilterSection } from '../sections/MetricsFilterSection/MetricsFilterSection';
import { SideBar } from '../SideBar';

jest.mock('shared/featureFlags/openFeature', () => ({
  isFiringAlertsSortingEnabled: jest.fn().mockResolvedValue(true),
  evaluateFeatureFlag: jest.fn().mockResolvedValue('control'),
}));
jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: {
      ...actual.sceneGraph,
      findByKeyAndType: jest.fn(),
      lookupVariable: jest.fn(),
      getAncestor: jest.fn(),
    },
  };
});

it('owns exactly one Rules alert filter and restores it while the panel is closed', async () => {
  jest.mocked(evaluateFeatureFlag).mockResolvedValue('control');
  jest.mocked(isFiringAlertsSortingEnabled).mockResolvedValue(true);
  const sidebar = new SideBar({});
  const rules = sidebar.state.sections.find((s) => s.state.key === 'filters-rule') as MetricsFilterSection;
  const chip = rules.state.control as FiringAlertChip;
  expect(chip).toBeInstanceOf(FiringAlertChip);
  expect(sidebar.state.visibleSection).toBeNull();
  chip.updateFromUrl({ 'filter-firing-alerts': 'true' });
  const getCounts = jest.fn().mockResolvedValue(new Map([['synthetic_errors_total', 1]]));
  jest.mocked(sceneGraph.findByKeyAndType).mockReturnValue({ getFiringAlertCounts: getCounts } as never);
  jest.mocked(sceneGraph.lookupVariable).mockReturnValue({
    state: { options: [{ label: 'synthetic_errors_total', value: 'synthetic_errors_total' }] },
  } as never);
  jest.mocked(sceneGraph.getAncestor).mockReturnValue({ state: { enginesMap: new Map() } } as never);
  const publish = jest.spyOn(chip, 'publishEvent');
  const cleanup = jest.fn();
  let load: Promise<void>;
  const activation = jest.spyOn(chip, 'activate').mockImplementation(() => {
    load = (chip as unknown as { onActivate: () => Promise<void> }).onActivate();
    return cleanup;
  });
  const parent = sidebar as unknown as { initOtherMetricsVar: () => () => void; onActivate: () => () => void };
  jest.spyOn(parent, 'initOtherMetricsVar').mockReturnValue(() => undefined);
  const deactivate = parent.onActivate();
  await load!;
  expect(publish).toHaveBeenCalledWith(
    expect.objectContaining({ payload: { type: 'firingAlertMetrics', filters: ['synthetic_errors_total'] } }),
    true
  );
  expect(sidebar.state.firingAlertActive).toBe(true);
  sidebar.setState({ visibleSection: rules });
  sidebar.setState({ visibleSection: null });
  expect(chip.state.active).toBe(true);
  expect(rules.state.control).toBe(chip);
  expect(activation).toHaveBeenCalledTimes(1);
  expect(getCounts).toHaveBeenCalledTimes(1);
  deactivate();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it('refreshes a collapsed alert control after engines/options load without a variable value change', () => {
  const sidebar = new SideBar({});
  const rules = sidebar.state.sections.find((s) => s.state.key === 'filters-rule') as MetricsFilterSection;
  const chip = rules.state.control as FiringAlertChip;
  chip.setState({ firingAlertMetrics: new Map([['synthetic_errors_total', 1]]) });
  const engines = new Map();
  jest.mocked(sceneGraph.getAncestor).mockReturnValue({ state: { enginesMap: engines } } as never);
  chip.refreshMatchingCount();
  expect(chip.state.matchingCount).toBe(0);
  engines.set(VAR_FILTERED_METRICS_VARIABLE, {
    filterEngine: {
      getFilters: () => ({
        categories: [],
        names: [],
        prefixes: [],
        suffixes: [],
        firingAlertMetrics: [],
        sloTrackedMetrics: [],
      }),
    },
  });
  jest
    .mocked(sceneGraph.lookupVariable)
    .mockReturnValue({
      state: { options: [{ label: 'synthetic_errors_total', value: 'synthetic_errors_total' }] },
    } as never);
  chip.refreshMatchingCount();
  expect(chip.state.matchingCount).toBe(1);
  expect(sidebar.state.visibleSection).toBeNull();
});
