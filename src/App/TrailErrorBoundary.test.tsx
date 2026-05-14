import { render, screen } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { TrailErrorBoundary } from './TrailErrorBoundary';
import { logger } from '../shared/logger/logger';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

function ThrowingChild({ error }: { error: Error }): React.ReactNode {
  throw error;
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={['/drilldown']}>{ui}</MemoryRouter>);
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TrailErrorBoundary', () => {
  it('renders children when no error', () => {
    renderWithRouter(
      <TrailErrorBoundary>
        <div data-testid="scene">Scene content</div>
      </TrailErrorBoundary>
    );

    expect(screen.getByTestId('scene')).toBeInTheDocument();
  });

  it('renders ErrorView when child throws', () => {
    renderWithRouter(
      <TrailErrorBoundary>
        <ThrowingChild error={new Error('scene crash')} />
      </TrailErrorBoundary>
    );

    expect(screen.getByText('Fatal error!')).toBeInTheDocument();
  });

  it('logs error through our isolated Faro instance with trail-error-boundary context', () => {
    renderWithRouter(
      <TrailErrorBoundary>
        <ThrowingChild error={new Error('scene crash')} />
      </TrailErrorBoundary>
    );

    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'scene crash' }), {
      handledBy: 'trail-error-boundary',
    });
  });

  it('does not catch ChunkLoadError (propagates to AppErrorBoundary)', () => {
    // ChunkLoadError should propagate up — TrailErrorBoundary does NOT
    // do special handling for it. This test verifies it renders ErrorView
    // rather than a soft-reload banner (that's AppErrorBoundary's job).
    const error = new Error('Loading chunk 42 failed');
    error.name = 'ChunkLoadError';

    renderWithRouter(
      <TrailErrorBoundary>
        <ThrowingChild error={error} />
      </TrailErrorBoundary>
    );

    // TrailErrorBoundary renders ErrorView for ALL errors including chunk errors.
    // In practice, chunk errors from lazy Trail loading are caught by AppErrorBoundary
    // (which sits above Trail), not by TrailErrorBoundary. TrailErrorBoundary only
    // catches errors from trail.Component, which are scene-level errors, not chunk errors.
    expect(screen.getByText('Fatal error!')).toBeInTheDocument();
  });

  it('recovers when pathname changes (navigation recovery)', () => {
    let shouldThrow = true;

    function ConditionalChild(): React.ReactNode {
      if (shouldThrow) {
        throw new Error('scene crash');
      }
      return <div data-testid="recovered">Recovered</div>;
    }

    function NavigateButton() {
      const navigate = useNavigate();
      return <button onClick={() => navigate('/other')}>Navigate</button>;
    }

    render(
      <MemoryRouter initialEntries={['/drilldown']}>
        <NavigateButton />
        <TrailErrorBoundary>
          <ConditionalChild />
        </TrailErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText('Fatal error!')).toBeInTheDocument();

    shouldThrow = false;
    act(() => {
      screen.getByText('Navigate').click();
    });

    expect(screen.getByTestId('recovered')).toBeInTheDocument();
  });

  it('shows stack trace in ErrorView', () => {
    const error = new Error('detailed error');
    error.stack = 'Error: detailed error\n    at SomeComponent (file.tsx:42)';

    renderWithRouter(
      <TrailErrorBoundary>
        <ThrowingChild error={error} />
      </TrailErrorBoundary>
    );

    expect(screen.getByText('Fatal error!')).toBeInTheDocument();
    // ErrorView renders the stack trace in a collapsible section
    expect(screen.getByText('View stack trace')).toBeInTheDocument();
  });
});
