import { render, screen } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { AppErrorBoundary, isChunkLoadError } from './AppErrorBoundary';
import { logger } from '../shared/logger/logger';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

const CHUNK_RELOAD_KEY = 'mdrilldown:chunk-reload-attempted';

function ThrowingChild({ error }: { error: Error }): React.ReactNode {
  throw error;
}

function renderWithRouter(ui: React.ReactElement, { route = '/drilldown' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  sessionStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('isChunkLoadError', () => {
  it('detects by error name', () => {
    const error = new Error('something');
    error.name = 'ChunkLoadError';
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('detects by "Loading chunk" message', () => {
    expect(isChunkLoadError(new Error('Loading chunk 123 failed'))).toBe(true);
  });

  it('detects by "dynamically imported module" message', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /foo.js'))).toBe(true);
  });

  it('returns false for regular errors', () => {
    expect(isChunkLoadError(new Error('TypeError: Cannot read property'))).toBe(false);
  });
});

describe('AppErrorBoundary', () => {
  it('renders children when no error', () => {
    renderWithRouter(
      <AppErrorBoundary>
        <div data-testid="child">Hello</div>
      </AppErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders ErrorView on render error', () => {
    renderWithRouter(
      <AppErrorBoundary>
        <ThrowingChild error={new Error('boom')} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Fatal error!')).toBeInTheDocument();
  });

  it('calls logger.error with handledBy context on render error', () => {
    renderWithRouter(
      <AppErrorBoundary>
        <ThrowingChild error={new Error('boom')} />
      </AppErrorBoundary>
    );

    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), {
      handledBy: 'React error boundary',
    });
  });

  it('renders auto-reload UI for ChunkLoadError (by name)', () => {
    const error = new Error('chunk failed');
    error.name = 'ChunkLoadError';

    renderWithRouter(
      <AppErrorBoundary>
        <ThrowingChild error={error} />
      </AppErrorBoundary>
    );

    expect(screen.queryByText('Fatal error!')).not.toBeInTheDocument();
    expect(screen.getByText(/reloading…/)).toBeInTheDocument();
  });

  it('renders auto-reload UI for chunk error by message pattern', () => {
    renderWithRouter(
      <AppErrorBoundary>
        <ThrowingChild error={new Error('Loading chunk 42 failed')} />
      </AppErrorBoundary>
    );

    expect(screen.queryByText('Fatal error!')).not.toBeInTheDocument();
    expect(screen.getByText(/reloading…/)).toBeInTheDocument();
  });

  it('logs ChunkLoadError with chunk-load-recovery handledBy', () => {
    const error = new Error('Loading chunk 42 failed');

    renderWithRouter(
      <AppErrorBoundary>
        <ThrowingChild error={error} />
      </AppErrorBoundary>
    );

    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Loading chunk 42 failed' }), {
      handledBy: 'chunk-load-recovery',
    });
  });

  it('shows manual reload UI when chunk reload was already attempted', () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
    const error = new Error('chunk failed');
    error.name = 'ChunkLoadError';

    renderWithRouter(
      <AppErrorBoundary>
        <ThrowingChild error={error} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Reload now')).toBeInTheDocument();
    expect(screen.getByText(/could not be loaded automatically/)).toBeInTheDocument();
  });

  it('recovers when pathname changes (navigation recovery)', () => {
    let shouldThrow = true;

    function ConditionalChild(): React.ReactNode {
      if (shouldThrow) {
        throw new Error('render error');
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
        <AppErrorBoundary>
          <ConditionalChild />
        </AppErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText('Fatal error!')).toBeInTheDocument();

    shouldThrow = false;
    act(() => {
      screen.getByText('Navigate').click();
    });

    expect(screen.getByTestId('recovered')).toBeInTheDocument();
  });

  it('clears sessionStorage key on successful mount', () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');

    renderWithRouter(
      <AppErrorBoundary>
        <div>OK</div>
      </AppErrorBoundary>
    );

    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
  });
});
