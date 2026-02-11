import { sceneGraph, type SceneTimeRange } from '@grafana/scenes';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';



import { type DataTrail } from 'AppDataTrail/DataTrail';
import { type MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { buildNavigateToMetricsParams, createAppUrl, createPromURLObject, parsePromQLQuery } from 'extensions/links';

import { LoadSearchModal } from './LoadSearchModal';
import { useSavedSearches, type SavedSearch } from './saveSearch';

jest.mock('./saveSearch');
jest.mock('extensions/links');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));
jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return {
    ...actual,
    Modal: Object.assign(
      ({ children, title, isOpen, onDismiss }: any) =>
        isOpen ? (
          <div data-testid="modal">
            <div>{title}</div>
            <button aria-label="Close" onClick={onDismiss}>
              Close
            </button>
            {children}
          </div>
        ) : null,
      { ButtonRow: ({ children }: any) => <div>{children}</div> }
    ),
  };
});

const mockUseSavedSearches = useSavedSearches as jest.MockedFunction<typeof useSavedSearches>;

const mockSearches: SavedSearch[] = [
  {
    uid: '1',
    title: 'Test Search 1',
    description: 'First test search',
    query: 'http_requests_total{method="GET"}',
    dsUid: 'test-ds',
    timestamp: Date.now(),
  },
  {
    uid: '2',
    title: 'Test Search 2',
    description: 'Second test search',
    query: 'up{job="prometheus"}',
    dsUid: 'test-ds',
    timestamp: Date.now() - 1,
  },
];

describe('LoadSearchModal', () => {
  const mockOnClose = jest.fn();
  const mockDeleteSearch = jest.fn();
  const mockSceneRef = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: { embedded: false },
    } as unknown as DataTrail);

    jest.spyOn(sceneGraph, 'findByKeyAndType').mockReturnValue({
      getValue: () => 'test-ds',
    } as unknown as MetricsDrilldownDataSourceVariable);

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

    mockUseSavedSearches.mockReturnValue({
      saveSearch: jest.fn(),
      searches: mockSearches,
      isLoading: false,
      deleteSearch: mockDeleteSearch,
    });
  });

  test('renders the modal with saved searches', () => {
    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(screen.getAllByText('Test Search 1')).toHaveLength(2);
    expect(screen.getByText('Test Search 2')).toBeInTheDocument();
  });

  test('Renders empty state when no searches', () => {
    mockUseSavedSearches.mockReturnValue({
      saveSearch: jest.fn(),
      searches: [],
      isLoading: false,
      deleteSearch: mockDeleteSearch,
    });

    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(screen.getByText('No saved searches to display.')).toBeInTheDocument();
  });

  test('Selects a search when clicked', () => {
    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    fireEvent.click(screen.getAllByLabelText('Test Search 2')[0]);

    expect(screen.getByText('up{job="prometheus"}')).toBeInTheDocument();
  });

  test('Calls deleteSearch when delete button is clicked', () => {
    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    const deleteButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(deleteButton);

    expect(mockDeleteSearch).toHaveBeenCalledWith('1');
  });

  test('Creates a link using parsePromQLQuery with relative time', () => {
    jest.mocked(parsePromQLQuery).mockClear();

    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(parsePromQLQuery).toHaveBeenCalledWith('http_requests_total{method="GET"}');
    expect(createPromURLObject).toHaveBeenCalledWith(
      'test-ds',
      expect.any(Array),
      'http_requests_total',
      'now-1h',
      'now'
    );
  });

  test('Creates a link with absolute time', () => {
    jest.mocked(parsePromQLQuery).mockClear();
    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      state: {
        value: {
          from: '2026-02-05T11:26:55.860Z',
          to: '2026-02-05T11:31:55.860Z',
          raw: { from: '2026-02-05T11:26:55.860Z', to: '2026-02-05T11:31:55.860Z' },
        },
      },
    } as unknown as SceneTimeRange);

    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(createPromURLObject).toHaveBeenCalledWith(
      'test-ds',
      expect.any(Array),
      'http_requests_total',
      '2026-02-05T11:26:55.860Z',
      '2026-02-05T11:31:55.860Z'
    );
  });
});
