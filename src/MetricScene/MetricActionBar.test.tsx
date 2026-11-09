import { sceneGraph } from '@grafana/scenes';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { MetricActionBar } from './MetricActionBar';
import { MetricScene } from './MetricScene';

jest.mock('shared/savedQueries/SaveQueryButton', () => ({ SaveQueryButton: () => null }));

jest.mock('shared/savedQueries/LoadQueryScene', () => {
  const { SceneObjectBase } = jest.requireActual('@grafana/scenes');
  return {
    LoadQueryScene: class extends SceneObjectBase {
      static Component = () => null;
    },
  };
});

describe('MetricActionBar selectors', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['breakdown', 'Breakdown'],
    ['related', 'Related metrics'],
    ['logs', 'Related logs'],
  ] as const)('identifies and activates the %s tab', (value, label) => {
    const metricScene = new MetricScene({ metric: 'up' });
    metricScene.setState({ actionView: value === 'breakdown' ? 'related' : 'breakdown' });
    const setActionView = jest.spyOn(metricScene, 'setActionView').mockImplementation(() => {});
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(metricScene);
    jest.spyOn(metricScene.relatedLogsOrchestrator, 'checkConditionsMetForRelatedLogs').mockReturnValue(false);
    const model = new MetricActionBar();
    render(<MetricActionBar.Component model={model} />);

    expect(screen.getByTestId('action-bar')).toBeInTheDocument();
    const tab = screen.getByTestId(`metric-action-tab-${value}`);
    expect(tab).toBe(screen.getByRole('tab', { name: label }));
    fireEvent.click(tab);
    expect(setActionView).toHaveBeenCalledWith(value);
  });
});
