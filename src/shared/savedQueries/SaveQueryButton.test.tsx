import { useDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { usePluginComponent } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataTrail } from 'AppDataTrail/DataTrail';
import { type MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { MetricScene } from 'MetricScene/MetricScene';

import { SaveQueryButton } from './SaveQueryButton';
jest.mock('@grafana/runtime');
jest.mock('@grafana/prometheus', () => ({
  utf8Support: (key: string) => key,
}));

jest.mock('@grafana/plugin-compat/datasources', () => ({
  useDataSourceInstance: jest.fn(),
}));

const useDataSourceInstanceMock = jest.mocked(useDataSourceInstance);
const openQueryLibraryComponentMock = jest.fn();

describe('SaveQueryButton', () => {
  const mockSceneRef = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockTrail = { state: { embedded: false } } as unknown as DataTrail;
    jest.spyOn(sceneGraph, 'getAncestor').mockImplementation((_ref, type) => {
      if (type === DataTrail) {
        return mockTrail;
      }
      if (type === MetricScene) {
        return {
          state: { metric: 'http_requests_total' },
        } as MetricScene;
      }
      return {} as any;
    });

    jest.spyOn(sceneGraph, 'findByKeyAndType').mockReturnValue({
      getValue: () => 'test-datasource-uid',
      state: {
        text: 'test-datasource-uid',
      },
      subscribeToState: () => ({ unsubscribe: jest.fn() }),
    } as unknown as MetricsDrilldownDataSourceVariable);

    const defaultFilters = [
      { key: 'method', operator: '=', value: 'GET' },
      { key: '__name__', operator: '=', value: 'http_requests_total' },
    ];
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue({
      state: { filters: defaultFilters },
      useState: () => ({ filters: defaultFilters }),
    } as any);

    openQueryLibraryComponentMock.mockReturnValue(<button>Save query</button>);
    jest.mocked(usePluginComponent).mockReturnValue({ component: openQueryLibraryComponentMock, isLoading: false });
    useDataSourceInstanceMock.mockReturnValue({
      isLoading: false,
      error: undefined,
      dataSource: { uid: 'test-datasource-uid', name: 'Test Datasource' } as any,
    });
  });

  test('should pass the metric query and selected datasource to Query Library', () => {
    render(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(openQueryLibraryComponentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        datasourceFilters: ['Test Datasource'],
        query: {
          refId: 'drilldown',
          datasource: { type: 'prometheus', uid: 'test-datasource-uid' },
          expr: 'http_requests_total{method="GET"}',
        },
      }),
      undefined
    );
  });

  test('should hide the save action when embedded', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockImplementation((_ref, type) => {
      if (type === DataTrail) {
        return { state: { embedded: true } } as unknown as DataTrail;
      }
      if (type === MetricScene) {
        return { state: { metric: 'http_requests_total' } } as MetricScene;
      }
      return {} as any;
    });

    render(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should disable saving without a metric or filters', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockImplementation((_ref, type) => {
      if (type === DataTrail) {
        return { state: { embedded: false } } as unknown as DataTrail;
      }
      throw new Error('No MetricScene ancestor');
    });

    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue({
      state: { filters: [] },
      useState: () => ({ filters: [] }),
    } as any);

    render(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
    expect(openQueryLibraryComponentMock).not.toHaveBeenCalled();
  });

  test('should pass a filter-only query to Query Library without a MetricScene', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockImplementation((_ref, type) => {
      if (type === DataTrail) {
        return { state: { embedded: false } } as unknown as DataTrail;
      }
      throw new Error('No MetricScene ancestor');
    });

    render(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(openQueryLibraryComponentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          refId: 'drilldown',
          datasource: { type: 'prometheus', uid: 'test-datasource-uid' },
          expr: '{method="GET"}',
        },
      }),
      undefined
    );
  });

  test.each([true, false])('should hide saving when Query Library is unavailable (loading: %s)', (isLoading) => {
    jest.mocked(usePluginComponent).mockReturnValue({
      component: isLoading ? openQueryLibraryComponentMock : undefined,
      isLoading,
    });

    render(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should leave legacy local saved queries untouched', () => {
    localStorage.setItem('grafana-metricsdrilldown-app.savedQueries', '[{"uid":"legacy","query":"up"}]');

    render(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(screen.getByRole('button', { name: 'Save query' })).toBeInTheDocument();
    expect(localStorage.getItem('grafana-metricsdrilldown-app.savedQueries')).toBe('[{"uid":"legacy","query":"up"}]');
    localStorage.removeItem('grafana-metricsdrilldown-app.savedQueries');
  });

  test('should hide the save action until the selected datasource settings arrive', () => {
    useDataSourceInstanceMock.mockReturnValueOnce({
      isLoading: false,
      dataSource: { uid: 'previous-datasource-uid', name: 'Previous Datasource' } as any,
    });

    const { rerender } = render(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(screen.queryByRole('button', { name: 'Save query' })).not.toBeInTheDocument();

    rerender(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(screen.getByRole('button', { name: 'Save query' })).toBeInTheDocument();
  });
});
