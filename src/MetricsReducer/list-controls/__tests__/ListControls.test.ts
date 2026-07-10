/**
 * ListControls scene-graph wiring tests.
 *
 * Verifies that FiringAlertChip is present in the ListControls SceneFlexLayout
 * as a first-class scene-graph child, keyed 'firing-alert-chip'.
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

import { sceneGraph } from '@grafana/scenes';

import { FiringAlertChip } from '../FiringAlertChip/FiringAlertChip';
import { ListControls } from '../ListControls';

describe('ListControls scene-graph wiring', () => {
  test('FiringAlertChip is present in the scene graph with key "firing-alert-chip"', () => {
    const controls = new ListControls({});
    const chip = sceneGraph.findByKeyAndType(controls, 'firing-alert-chip', FiringAlertChip);
    expect(chip).toBeInstanceOf(FiringAlertChip);
  });
});
