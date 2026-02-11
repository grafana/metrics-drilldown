import { getAppEvents } from '@grafana/runtime';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';



import { useCheckForExistingQuery, useSavedQueries } from './savedQuery';
import { SaveQueryModal } from './SaveQueryModal';

jest.mock('./savedQuery');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(),
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

const mockUseSavedQueries = jest.mocked(useSavedQueries);
const mockUseCheckForExistingQuery = jest.mocked(useCheckForExistingQuery);

describe('SaveQueryModal', () => {
  const mockOnClose = jest.fn();
  const mockSaveQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAppEvents).mockReturnValue({ publish: jest.fn() } as any);
    mockUseCheckForExistingQuery.mockReturnValue(undefined);

    mockUseSavedQueries.mockReturnValue({
      saveQuery: mockSaveQuery,
      isLoading: false,
      queries: [],
      deleteQuery: jest.fn(),
    });
  });

  test('renders the modal with query', () => {
    render(<SaveQueryModal dsUid="test-ds" query='http_requests_total{method="GET"}' onClose={mockOnClose} />);

    expect(screen.getByText('Save current query')).toBeInTheDocument();
    expect(screen.getByText('http_requests_total{method="GET"}')).toBeInTheDocument();
  });

  test('submits the form with title and description', async () => {
    mockSaveQuery.mockResolvedValue(undefined);

    render(<SaveQueryModal dsUid="test-ds" query='http_requests_total{method="GET"}' onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'My Query' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test description' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockSaveQuery).toHaveBeenCalledWith({
        description: 'Test description',
        dsUid: 'test-ds',
        query: 'http_requests_total{method="GET"}',
        title: 'My Query',
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('shows alert when query already exists', () => {
    mockUseCheckForExistingQuery.mockReturnValue({
      description: 'Test description',
      dsUid: 'test-ds',
      query: 'http_requests_total{method="GET"}',
      title: 'Existing Query',
      timestamp: 123456,
      uid: 'test',
    });

    render(<SaveQueryModal dsUid="test-ds" query='http_requests_total{method="GET"}' onClose={mockOnClose} />);

    expect(screen.getByText(/previously saved query/i)).toBeInTheDocument();
    expect(screen.getByText(/Existing Query/i)).toBeInTheDocument();
  });

  test('disables submit button when title is empty', () => {
    render(<SaveQueryModal dsUid="test-ds" query='http_requests_total{method="GET"}' onClose={mockOnClose} />);

    const submitButton = screen.getByRole('button', { name: /^save$/i });
    expect(submitButton).toBeDisabled();
  });
});
