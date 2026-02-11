

import { type PromQuery } from '@grafana/prometheus';
import { usePluginComponent } from '@grafana/runtime';
import { sceneGraph, type SceneTimeRange } from '@grafana/scenes';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { type MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { buildNavigateToMetricsParams, createAppUrl, createPromURLObject, parsePromQLQuery } from 'extensions/links';

import { LoadSearchScene } from './LoadSearchScene';
import { isQueryLibrarySupported, useHasSavedSearches } from './saveSearch';

jest.mock('./saveSearch');
jest.mock('./LoadSearchModal', () => ({
  LoadSearchModal: ({ onClose }: { onClose(): void }) => (
    <div data-testid="load-search-modal">
      Load a previously saved search
      <button aria-label="Close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));
jest.mock('@grafana/runtime');
jest.mock('extensions/links');

const mockUseHasSavedSearches = jest.mocked(useHasSavedSearches);

function FakeExposedComponent({ onSelectQuery }: Readonly<{ onSelectQuery(query: PromQuery): void }>) {
  return (
    <div>
      <button
        onClick={() => {
          onSelectQuery({
            refId: 'A',
            datasource: {
              type: 'prometheus',
              uid: 'test-ds',
            },
            expr: 'http_requests_total{method="GET"}',
          });
        }}
      >
        Select
      </button>
    </div>
  );
}

describe('LoadSearchScene', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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

    jest.mocked(usePluginComponent).mockReturnValue({ component: undefined, isLoading: false });
    jest.mocked(isQueryLibrarySupported).mockReturnValue(false);
  });

  test('Disables button when there are no saved searches', () => {
    mockUseHasSavedSearches.mockReturnValue(false);

    const scene = new LoadSearchScene();
    render(<scene.Component model={scene} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  test('Enables button when there are saved searches', () => {
    mockUseHasSavedSearches.mockReturnValue(true);

    const scene = new LoadSearchScene();
    render(<scene.Component model={scene} />);

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });

  test('Opens modal when button is clicked', () => {
    mockUseHasSavedSearches.mockReturnValue(true);

    const scene = new LoadSearchScene();
    render(<scene.Component model={scene} />);

    expect(screen.queryByText('Load a previously saved search')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByText('Load a previously saved search')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));

    expect(screen.queryByText('Load a previously saved search')).not.toBeInTheDocument();
  });

  test('Returns null when the scene is embedded', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: { embedded: true },
    } as unknown as DataTrail);

    const scene = new LoadSearchScene();
    const { container } = render(<scene.Component model={scene} />);

    expect(container.firstChild).toBeNull();
  });

  test('Uses the exposed component if available', () => {
    const component = () => <div>Exposed component</div>;
    jest.mocked(isQueryLibrarySupported).mockReturnValue(true);
    jest.mocked(usePluginComponent).mockReturnValue({ component, isLoading: false });

    const scene = new LoadSearchScene();
    render(<scene.Component model={scene} />);

    expect(screen.getByText('Exposed component')).toBeInTheDocument();
  });

  describe('Loading a search', () => {
    beforeEach(() => {
      jest.mocked(parsePromQLQuery).mockClear();
      jest.mocked(isQueryLibrarySupported).mockReturnValue(true);
      // @ts-expect-error FakeExposedComponent has different shape
      jest.mocked(usePluginComponent).mockReturnValue({ component: FakeExposedComponent, isLoading: false });
      mockUseHasSavedSearches.mockReturnValue(true);
    });

    test('Parses the query and navigates when a search is selected', () => {
      const scene = new LoadSearchScene();
      render(<scene.Component model={scene} />);

      fireEvent.click(screen.getByText('Select'));

      expect(parsePromQLQuery).toHaveBeenCalledWith('http_requests_total{method="GET"}');
      expect(createPromURLObject).toHaveBeenCalledWith(
        'test-ds',
        expect.any(Array),
        'http_requests_total',
        'now-1h',
        'now'
      );
    });

    test('Uses absolute time range when available', () => {
      jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
        state: {
          value: {
            from: '2026-02-05T11:26:55.860Z',
            to: '2026-02-05T11:31:55.860Z',
            raw: { from: '2026-02-05T11:26:55.860Z', to: '2026-02-05T11:31:55.860Z' },
          },
        },
      } as unknown as SceneTimeRange);

      const scene = new LoadSearchScene();
      render(<scene.Component model={scene} />);

      fireEvent.click(screen.getByText('Select'));

      expect(createPromURLObject).toHaveBeenCalledWith(
        'test-ds',
        expect.any(Array),
        'http_requests_total',
        '2026-02-05T11:26:55.860Z',
        '2026-02-05T11:31:55.860Z'
      );
    });
  });
});
