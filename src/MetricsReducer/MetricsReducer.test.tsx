import { render, screen, within } from '@testing-library/react';
import React from 'react';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: () => 0,
}));

jest.mock('shared/savedQueries/SaveQueryButton', () => ({
  SaveQueryButton: () => <div data-testid="save-query-button">Save</div>,
}));

jest.mock('shared/savedQueries/LoadQueryScene', () => {
  const { SceneObjectBase } = jest.requireActual('@grafana/scenes');

  class MockLoadQueryScene extends SceneObjectBase {
    static readonly Component = () => <div data-testid="load-query-button">Load</div>;
  }

  return { LoadQueryScene: MockLoadQueryScene };
});

jest.mock('./list-controls/ListControls', () => {
  const { SceneObjectBase } = jest.requireActual('@grafana/scenes');

  class MockListControls extends SceneObjectBase {
    static readonly Component = () => <div data-testid="mock-list-controls">ListControls</div>;
  }

  return { ListControls: MockListControls };
});

jest.mock('./SideBar/SideBar', () => {
  const { SceneObjectBase } = jest.requireActual('@grafana/scenes');

  class MockSideBar extends SceneObjectBase {
    static readonly Component = () => <div data-testid="mock-sidebar">SideBar</div>;
  }

  return { SideBar: MockSideBar };
});

jest.mock('./metrics-variables/FilteredMetricsVariable', () => {
  const { CustomVariable } = jest.requireActual('@grafana/scenes');

  class MockFilteredMetricsVariable extends CustomVariable {
    constructor() {
      super({
        name: 'filtered-metrics-wingman',
        key: 'filtered-metrics-wingman',
      });
    }

    static readonly Component = () => null;
  }

  return {
    FilteredMetricsVariable: MockFilteredMetricsVariable,
    VAR_FILTERED_METRICS_VARIABLE: 'filtered-metrics-wingman',
  };
});

import { MetricsReducer } from './MetricsReducer';

describe('MetricsReducer', () => {
  test('renders load query button within list controls area', () => {
    const scene = new MetricsReducer();
    render(<MetricsReducer.Component model={scene} />);

    const listControlsArea = screen.getByTestId('list-controls');
    expect(within(listControlsArea).getByTestId('load-query-button')).toBeInTheDocument();
  });

  test('renders save query button within list controls area', () => {
    const scene = new MetricsReducer();
    render(<MetricsReducer.Component model={scene} />);

    const listControlsArea = screen.getByTestId('list-controls');
    expect(within(listControlsArea).getByTestId('save-query-button')).toBeInTheDocument();
  });
});
