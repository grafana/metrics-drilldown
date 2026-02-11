import { getAppEvents } from '@grafana/runtime';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';



import { useCheckForExistingSearch, useSavedSearches } from './saveSearch';
import { SaveSearchModal } from './SaveSearchModal';

jest.mock('./saveSearch');
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

const mockUseSaveSearches = jest.mocked(useSavedSearches);
const mockUseCheckForExistingSearch = jest.mocked(useCheckForExistingSearch);

describe('SaveSearchModal', () => {
  const mockOnClose = jest.fn();
  const mockSaveSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAppEvents).mockReturnValue({ publish: jest.fn() } as any);
    mockUseCheckForExistingSearch.mockReturnValue(undefined);

    mockUseSaveSearches.mockReturnValue({
      saveSearch: mockSaveSearch,
      isLoading: false,
      searches: [],
      deleteSearch: jest.fn(),
    });
  });

  test('renders the modal with query', () => {
    render(<SaveSearchModal dsUid="test-ds" query='http_requests_total{method="GET"}' onClose={mockOnClose} />);

    expect(screen.getByText('Save current search')).toBeInTheDocument();
    expect(screen.getByText('http_requests_total{method="GET"}')).toBeInTheDocument();
  });

  test('submits the form with title and description', async () => {
    mockSaveSearch.mockResolvedValue(undefined);

    render(<SaveSearchModal dsUid="test-ds" query='http_requests_total{method="GET"}' onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'My Search' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test description' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockSaveSearch).toHaveBeenCalledWith({
        description: 'Test description',
        dsUid: 'test-ds',
        query: 'http_requests_total{method="GET"}',
        title: 'My Search',
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('shows alert when search already exists', () => {
    mockUseCheckForExistingSearch.mockReturnValue({
      description: 'Test description',
      dsUid: 'test-ds',
      query: 'http_requests_total{method="GET"}',
      title: 'Existing Search',
      timestamp: 123456,
      uid: 'test',
    });

    render(<SaveSearchModal dsUid="test-ds" query='http_requests_total{method="GET"}' onClose={mockOnClose} />);

    expect(screen.getByText(/previously saved search/i)).toBeInTheDocument();
    expect(screen.getByText(/Existing Search/i)).toBeInTheDocument();
  });

  test('disables submit button when title is empty', () => {
    render(<SaveSearchModal dsUid="test-ds" query='http_requests_total{method="GET"}' onClose={mockOnClose} />);

    const submitButton = screen.getByRole('button', { name: /^save$/i });
    expect(submitButton).toBeDisabled();
  });
});
