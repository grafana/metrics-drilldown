import { getDataSourceInstanceList, getDefaultDataSourceInstanceListItem } from '@grafana/plugin-compat/datasources';
import { EmbeddedScene, SceneTimeRange } from '@grafana/scenes';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { displayError } from 'MetricsReducer/helpers/displayStatus';
import { DataSourceFetcher, getDataSourceFetcher } from 'shared/utils/utils.datasource';
import { activateFullSceneTree } from 'shared/utils/utils.testing';

import { RelatedLogsOrchestrator } from './RelatedLogsOrchestrator';
import { RelatedLogsScene } from './RelatedLogsScene';
import { EventActionViewDataLoadComplete } from '../EventActionViewDataLoadComplete';
import { type MetricScene } from '../MetricScene';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceList: jest.fn(),
  getDefaultDataSourceInstanceListItem: jest.fn(),
}));
jest.mock('shared/utils/utils.datasource', () => ({
  ...jest.requireActual('shared/utils/utils.datasource'),
  getDataSourceFetcher: jest.fn(),
}));
jest.mock('MetricsReducer/helpers/displayStatus', () => ({ displayError: jest.fn() }));
jest.mock('../../Integrations/logs/labelsCrossReference', () => ({
  createLabelsCrossReferenceConnector: jest.fn(),
}));
jest.mock('../../Integrations/logs/lokiRecordingRules', () => ({
  createLokiRecordingRulesConnector: jest.fn(),
}));
jest.mock('./OpenInLogsDrilldownButton', () => ({ OpenInLogsDrilldownButton: () => null }));
jest.mock('../MetricActionBar', () => ({ actionViews: { relatedLogs: 'logs' } }));

describe('RelatedLogsScene datasource discovery', () => {
  let orchestrator: RelatedLogsOrchestrator;
  let deactivate: (() => void) | undefined;

  beforeEach(() => {
    jest.mocked(getDataSourceInstanceList).mockResolvedValue([]);
    jest.mocked(getDefaultDataSourceInstanceListItem).mockResolvedValue(undefined);
    jest.mocked(getDataSourceFetcher).mockReturnValue(new DataSourceFetcher());
    orchestrator = new RelatedLogsOrchestrator({ state: { metric: 'test_metric' } } as MetricScene);
  });

  afterEach(() => {
    cleanup();
    act(() => deactivate?.());
    deactivate = undefined;
    jest.restoreAllMocks();
  });

  function mountScene() {
    const scene = new RelatedLogsScene({ orchestrator });
    const parent = new EmbeddedScene({ $timeRange: new SceneTimeRange({}), body: scene });
    act(() => {
      deactivate = activateFullSceneTree(parent);
    });
    render(<scene.Component model={scene} />);
    return scene;
  }

  it('should stop loading and show a fallback when datasource discovery rejects', async () => {
    jest.mocked(getDataSourceInstanceList).mockRejectedValueOnce(new Error('Discovery failed'));
    const scene = mountScene();
    const publishEvent = jest.spyOn(scene, 'publishEvent');

    expect(scene.state.loading).toBe(true);

    await waitFor(() => expect(scene.state.loading).toBe(false));

    expect(await screen.findByText('No related logs found')).toBeInTheDocument();
    expect(displayError).toHaveBeenCalledTimes(1);
    expect(displayError).toHaveBeenCalledWith(new Error('Discovery failed'), [
      'Failed to load data sources for related logs.',
    ]);
    expect(publishEvent).toHaveBeenCalledWith(new EventActionViewDataLoadComplete({ currentActionView: 'logs' }), true);
  });

  it('should handle datasource discovery failure after filters change', async () => {
    const scene = mountScene();
    await waitFor(() => expect(scene.state.loading).toBe(false));
    jest.mocked(getDataSourceInstanceList).mockRejectedValueOnce(new Error('Discovery failed'));

    act(() => orchestrator.handleFiltersChange());

    await waitFor(() => expect(displayError).toHaveBeenCalledTimes(1));
  });

  it('should show the existing empty state without reporting an error when no datasources exist', async () => {
    const scene = mountScene();

    await waitFor(() => expect(scene.state.loading).toBe(false));

    expect(await screen.findByText('No related logs found')).toBeInTheDocument();
    expect(displayError).not.toHaveBeenCalled();
  });
});
