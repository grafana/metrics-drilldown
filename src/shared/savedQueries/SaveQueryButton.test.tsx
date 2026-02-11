

import { usePluginComponent } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { DataTrail } from 'AppDataTrail/DataTrail';
import { type MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { MetricScene } from 'MetricScene/MetricScene';

import { isQueryLibrarySupported } from './savedQuery';
import { SaveQueryButton } from './SaveQueryButton';

jest.mock('./savedQuery');
jest.mock('./SaveQueryModal', () => ({
  SaveQueryModal: ({ onClose }: { onClose(): void }) => (
    <div data-testid="save-query-modal">
      Save current query
      <button onClick={onClose}>Cancel</button>
    </div>
  ),
}));
jest.mock('@grafana/runtime');
jest.mock('@grafana/prometheus', () => ({
  utf8Support: (key: string) => key,
}));

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
    } as unknown as MetricsDrilldownDataSourceVariable);

    const defaultFilters = [
      { key: 'method', operator: '=', value: 'GET' },
      { key: '__name__', operator: '=', value: 'http_requests_total' },
    ];
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue({
      state: { filters: defaultFilters },
      useState: () => ({ filters: defaultFilters }),
    } as any);

    jest.mocked(usePluginComponent).mockReturnValue({ component: undefined, isLoading: false });
    jest.mocked(isQueryLibrarySupported).mockReturnValue(false);
  });

  test('Opens the modal when the button is clicked', () => {
    render(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(screen.queryByText('Save current query')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    expect(screen.getByText('Save current query')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(screen.queryByText('Save current query')).not.toBeInTheDocument();
  });

  test('Returns null when the scene is embedded', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockImplementation((_ref, type) => {
      if (type === DataTrail) {
        return { state: { embedded: true } } as unknown as DataTrail;
      }
      if (type === MetricScene) {
        return { state: { metric: 'http_requests_total' } } as MetricScene;
      }
      return {} as any;
    });

    const { container } = render(<SaveQueryButton sceneRef={mockSceneRef} />);
    expect(container.firstChild).toBeNull();
  });

  test('Renders disabled button when no MetricScene ancestor and no filters', () => {
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

    const button = screen.getByRole('button', { name: /Save/i });
    expect(button).toBeDisabled();
  });

  test('Builds filter-only promql when no MetricScene ancestor but filters exist', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockImplementation((_ref, type) => {
      if (type === DataTrail) {
        return { state: { embedded: false } } as unknown as DataTrail;
      }
      throw new Error('No MetricScene ancestor');
    });

    render(<SaveQueryButton sceneRef={mockSceneRef} />);

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    expect(screen.getByText('Save current query')).toBeInTheDocument();
  });

  test('Uses the exposed component if available', () => {
    const component = () => <div>Exposed component</div>;
    jest.mocked(isQueryLibrarySupported).mockReturnValue(true);
    jest.mocked(usePluginComponent).mockReturnValue({ component, isLoading: false });

    render(<SaveQueryButton sceneRef={mockSceneRef} />);

    expect(screen.getByText('Exposed component')).toBeInTheDocument();
  });
});
