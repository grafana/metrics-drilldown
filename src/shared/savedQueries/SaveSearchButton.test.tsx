

import { usePluginComponent } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { DataTrail } from 'AppDataTrail/DataTrail';
import { type MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { MetricScene } from 'MetricScene/MetricScene';

import { isQueryLibrarySupported } from './saveSearch';
import { SaveSearchButton } from './SaveSearchButton';

jest.mock('./saveSearch');
jest.mock('./SaveSearchModal', () => ({
  SaveSearchModal: ({ onClose }: { onClose(): void }) => (
    <div data-testid="save-search-modal">
      Save current search
      <button onClick={onClose}>Cancel</button>
    </div>
  ),
}));
jest.mock('@grafana/runtime');
jest.mock('@grafana/prometheus', () => ({
  utf8Support: (key: string) => key,
}));

describe('SaveSearchButton', () => {
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

    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue({
      state: {
        filters: [
          { key: 'method', operator: '=', value: 'GET' },
          { key: '__name__', operator: '=', value: 'http_requests_total' },
        ],
      },
    } as any);

    jest.mocked(usePluginComponent).mockReturnValue({ component: undefined, isLoading: false });
    jest.mocked(isQueryLibrarySupported).mockReturnValue(false);
  });

  test('Opens the modal when the button is clicked', () => {
    render(<SaveSearchButton sceneRef={mockSceneRef} />);

    expect(screen.queryByText('Save current search')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    expect(screen.getByText('Save current search')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(screen.queryByText('Save current search')).not.toBeInTheDocument();
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

    const { container } = render(<SaveSearchButton sceneRef={mockSceneRef} />);
    expect(container.firstChild).toBeNull();
  });

  test('Uses the exposed component if available', () => {
    const component = () => <div>Exposed component</div>;
    jest.mocked(isQueryLibrarySupported).mockReturnValue(true);
    jest.mocked(usePluginComponent).mockReturnValue({ component, isLoading: false });

    render(<SaveSearchButton sceneRef={mockSceneRef} />);

    expect(screen.getByText('Exposed component')).toBeInTheDocument();
  });
});
