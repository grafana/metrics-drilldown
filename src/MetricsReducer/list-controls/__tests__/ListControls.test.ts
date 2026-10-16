/**
 * ListControls scene-graph wiring tests.
 *
 * Verifies Jev replaces the alert filter in the toolbar; SLO filtering stays independent.
 *
 * We test pure scene-graph structure here (no rendering, no DOM), so none of
 * the heavy Grafana/scenes rendering infrastructure is needed.
 */

// Mock all heavy transitive deps that ListControls pulls in so we can test
// just the wiring logic without the full rendering stack.
jest.mock('../QuickSearch/CountsProvider/MetricVariableCountsProvider', () => ({
  MetricVariableCountsProvider: jest.fn().mockImplementation(() => ({
    state: {},
    setState: jest.fn(),
  })),
}));

jest.mock('../QuickSearch/QuickSearch', () => {
  const { SceneObjectBase } = jest.requireActual('@grafana/scenes');
  class MockQuickSearch extends SceneObjectBase {
    constructor() {
      super({ key: 'quick-search' });
    }
    static readonly Component = () => null;
  }
  return { QuickSearch: MockQuickSearch };
});

jest.mock('../MetricsSorter/MetricsSorter', () => {
  const { SceneObjectBase } = jest.requireActual('@grafana/scenes');
  class MockMetricsSorter extends SceneObjectBase {
    constructor() {
      super({ key: 'metrics-sorter' });
    }
    static readonly Component = () => null;
  }
  return { MetricsSorter: MockMetricsSorter };
});

jest.mock('../LayoutSwitcher', () => {
  const { SceneObjectBase } = jest.requireActual('@grafana/scenes');
  class MockLayoutSwitcher extends SceneObjectBase {
    constructor() {
      super({ key: 'layout-switcher' });
    }
    static readonly Component = () => null;
  }
  return { LayoutSwitcher: MockLayoutSwitcher };
});

jest.mock('../FiringAlertChip/FiringAlertChip', () => {
  const { SceneObjectBase } = jest.requireActual('@grafana/scenes');
  class MockFiringAlertChip extends SceneObjectBase {
    constructor() {
      super({ key: 'firing-alert-chip' });
    }
    static readonly Component = () => null;
  }
  return { FiringAlertChip: MockFiringAlertChip };
});

jest.mock('../SloTrackedChip/SloTrackedChip', () => {
  const { SceneObjectBase } = jest.requireActual('@grafana/scenes');
  class MockSloTrackedChip extends SceneObjectBase {
    constructor() {
      super({ key: 'slo-tracked-chip' });
    }
    static readonly Component = () => null;
  }
  return { SloTrackedChip: MockSloTrackedChip };
});

import { sceneGraph, type SceneFlexItem, type SceneFlexLayout } from '@grafana/scenes';

import { FiringAlertChip } from '../FiringAlertChip/FiringAlertChip';
import { JevSort } from '../JevSort/JevSort';
import { ListControls } from '../ListControls';
import { SloTrackedChip } from '../SloTrackedChip/SloTrackedChip';

describe('ListControls scene-graph wiring', () => {
  test('Jev occupies the former alert position, with no toolbar alert-filter scene', () => {
    const controls = new ListControls({});
    const jev = sceneGraph.findByKeyAndType(controls, 'jev-sort', JevSort);
    expect(jev).toBeInstanceOf(JevSort);
    expect(sceneGraph.findAllObjects(controls, (obj) => obj instanceof FiringAlertChip)).toHaveLength(0);
    expect(((controls.state.body as SceneFlexLayout).state.children[1] as SceneFlexItem).state.body).toBe(jev);
  });

  test('SloTrackedChip is present in the scene graph with key "slo-tracked-chip"', () => {
    const controls = new ListControls({});
    const chip = sceneGraph.findByKeyAndType(controls, 'slo-tracked-chip', SloTrackedChip);
    expect(chip).toBeInstanceOf(SloTrackedChip);
  });
});
