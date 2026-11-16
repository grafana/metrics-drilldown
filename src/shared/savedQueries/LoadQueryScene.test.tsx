import { getDataSourceInstanceSettings } from '@grafana/plugin-compat/datasources';
import { type PromQuery } from '@grafana/prometheus';
import { getAppEvents, locationService, usePluginComponent } from '@grafana/runtime';
import { sceneGraph, type SceneTimeRange } from '@grafana/scenes';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { type MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { buildNavigateToMetricsParams, createAppUrl, createPromURLObject, parsePromQLQuery } from 'extensions/links';

import { LoadQueryScene } from './LoadQueryScene';
import { type OpenQueryLibraryComponentProps } from './savedQuery';
jest.mock('@grafana/runtime');
jest.mock('extensions/links');

jest.mock('@grafana/plugin-compat/datasources', () => ({ getDataSourceInstanceSettings: jest.fn() }));
const getDataSourceInstanceSettingsMock = jest.mocked(getDataSourceInstanceSettings);
const openQueryLibraryComponentMock = jest.fn();
const publishMock = jest.fn();

function FakeExposedComponent({ onSelectQuery }: Readonly<OpenQueryLibraryComponentProps>) {
  const query: PromQuery = {
    refId: 'A',
    datasource: { type: 'prometheus', uid: 'test-ds' },
    expr: 'http_requests_total{method="GET"}',
  };

  return (
    <div>
      <button
        onClick={() => {
          onSelectQuery?.(query);
        }}
      >
        Select
      </button>
    </div>
  );
}

describe('LoadQueryScene', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getDataSourceInstanceSettingsMock.mockResolvedValue({ name: 'Test Datasource' } as any);

    jest.spyOn(sceneGraph, 'findByKeyAndType').mockReturnValue({
      getValue: () => 'test-datasource-uid',
      subscribeToState: jest.fn(),
      state: {
        text: 'test-datasource-uid',
      },
    } as unknown as MetricsDrilldownDataSourceVariable);

    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: {
        embedded: false,
      },
    } as unknown as DataTrail);

    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      state: { value: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } } },
    } as unknown as SceneTimeRange);

    jest.mocked(parsePromQLQuery).mockReturnValue({
      metric: 'http_requests_total',
      labels: [{ label: 'method', op: '=', value: 'GET' }],
      hasErrors: false,
      errors: [],
    });
    jest.mocked(createPromURLObject).mockReturnValue({});
    jest.mocked(buildNavigateToMetricsParams).mockReturnValue(new URLSearchParams());
    jest.mocked(createAppUrl).mockReturnValue('/a/grafana-metricsdrilldown-app/drilldown');

    openQueryLibraryComponentMock.mockImplementation(FakeExposedComponent);
    jest.mocked(usePluginComponent).mockReturnValue({ component: openQueryLibraryComponentMock, isLoading: false });
    jest.mocked(getAppEvents).mockReturnValue({ publish: publishMock } as unknown as ReturnType<typeof getAppEvents>);
  });

  test.each([true, false])('should hide loading when Query Library is unavailable (loading: %s)', async (isLoading) => {
    jest.mocked(usePluginComponent).mockReturnValue({
      component: isLoading ? openQueryLibraryComponentMock : undefined,
      isLoading,
    });

    const scene = new LoadQueryScene();
    render(<scene.Component model={scene} />);

    await waitFor(() => expect(scene.state.dsName).toBe('Test Datasource'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should hide loading when the datasource cannot be resolved', async () => {
    getDataSourceInstanceSettingsMock.mockResolvedValueOnce(undefined);

    const scene = new LoadQueryScene();
    render(<scene.Component model={scene} />);

    await waitFor(() => expect(getDataSourceInstanceSettingsMock).toHaveBeenCalledWith('test-datasource-uid'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should leave legacy local saved queries untouched', async () => {
    localStorage.setItem('grafana-metricsdrilldown-app.savedQueries', '[{"uid":"legacy","query":"up"}]');

    const scene = new LoadQueryScene();
    render(<scene.Component model={scene} />);

    expect(await screen.findByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(localStorage.getItem('grafana-metricsdrilldown-app.savedQueries')).toBe('[{"uid":"legacy","query":"up"}]');
    localStorage.removeItem('grafana-metricsdrilldown-app.savedQueries');
  });

  test('should hide the load action when embedded', async () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: { embedded: true },
    } as unknown as DataTrail);

    const scene = new LoadQueryScene();
    render(<scene.Component model={scene} />);

    await waitFor(() => expect(scene.state.dsName).toBe('Test Datasource'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should pass the selected datasource and drilldown context to Query Library', async () => {
    const scene = new LoadQueryScene();
    render(<scene.Component model={scene} />);

    expect(await screen.findByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(openQueryLibraryComponentMock).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'drilldown', datasourceFilters: ['Test Datasource'], icon: 'folder-open' }),
      undefined
    );
  });

  describe('Loading a query', () => {
    test('should parse the selected query and navigate with the current time range', async () => {
      const scene = new LoadQueryScene();
      render(<scene.Component model={scene} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Select' }));

      expect(parsePromQLQuery).toHaveBeenCalledWith('http_requests_total{method="GET"}');
      expect(createPromURLObject).toHaveBeenCalledWith(
        'test-ds',
        [{ label: 'method', op: '=', value: 'GET' }],
        'http_requests_total',
        'now-1h',
        'now'
      );
      expect(locationService.push).toHaveBeenCalledWith('/a/grafana-metricsdrilldown-app/drilldown');
    });

    test('should reject non-Prometheus queries without navigating', async () => {
      const scene = new LoadQueryScene();
      render(<scene.Component model={scene} />);

      await screen.findByRole('button', { name: 'Select' });
      openQueryLibraryComponentMock.mock.calls[0][0].onSelectQuery({
        refId: 'A',
        datasource: { type: 'loki', uid: 'test-ds' },
      });

      expect(publishMock).toHaveBeenCalledWith({
        payload: ['Please select a Prometheus query.'],
        type: 'alert-error',
      });
      expect(parsePromQLQuery).not.toHaveBeenCalled();
      expect(locationService.push).not.toHaveBeenCalled();
    });

    test('should show an error for queries that cannot be represented in Drilldown', async () => {
      jest.mocked(parsePromQLQuery).mockImplementationOnce(() => {
        throw new Error('Unsupported expression');
      });

      const scene = new LoadQueryScene();
      render(<scene.Component model={scene} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Select' }));

      expect(publishMock).toHaveBeenCalledWith({
        payload: [
          'This query contains expressions that cannot be represented in Metrics Drilldown. Only simple metric{label} selectors are supported.',
        ],
        type: 'alert-error',
      });
      expect(locationService.push).not.toHaveBeenCalled();
    });

    test('should use the absolute time range when available', async () => {
      jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
        state: {
          value: {
            from: '2026-02-05T11:26:55.860Z',
            to: '2026-02-05T11:31:55.860Z',
            raw: { from: '2026-02-05T11:26:55.860Z', to: '2026-02-05T11:31:55.860Z' },
          },
        },
      } as unknown as SceneTimeRange);

      const scene = new LoadQueryScene();
      render(<scene.Component model={scene} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Select' }));

      expect(createPromURLObject).toHaveBeenCalledWith(
        'test-ds',
        [{ label: 'method', op: '=', value: 'GET' }],
        'http_requests_total',
        '2026-02-05T11:26:55.860Z',
        '2026-02-05T11:31:55.860Z'
      );
    });
  });
});
