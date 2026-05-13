import { render, screen } from '@testing-library/react';
import React from 'react';

import { ExposedComponentErrorBoundary } from './ExposedComponentErrorBoundary';
import { logger } from '../shared/logger/logger';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string, interpolation?: Record<string, string>) => {
    if (interpolation) {
      return Object.entries(interpolation).reduce(
        (result, [key, value]) => result.replace(`{{${key}}}`, value),
        defaultValue
      );
    }
    return defaultValue;
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

function ThrowingChild({ error }: { error: Error }): React.ReactNode {
  throw error;
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ExposedComponentErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ExposedComponentErrorBoundary boundaryName="test-boundary" componentName="Test Component">
        <div data-testid="child">Hello</div>
      </ExposedComponentErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders an inline Alert when child throws', () => {
    render(
      <ExposedComponentErrorBoundary boundaryName="test-boundary" componentName="Test Component">
        <ThrowingChild error={new Error('render boom')} />
      </ExposedComponentErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('Test Component failed to load. Please try again or contact your organization admin.')
    ).toBeInTheDocument();
  });

  it('does not render ErrorView (full-page error)', () => {
    render(
      <ExposedComponentErrorBoundary boundaryName="test-boundary" componentName="Entity Metrics">
        <ThrowingChild error={new Error('render boom')} />
      </ExposedComponentErrorBoundary>
    );

    expect(screen.queryByText('Fatal error!')).not.toBeInTheDocument();
  });

  it('logs error through our isolated Faro instance with correct context', () => {
    render(
      <ExposedComponentErrorBoundary boundaryName="test-boundary" componentName="Entity Metrics">
        <ThrowingChild error={new Error('render boom')} />
      </ExposedComponentErrorBoundary>
    );

    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'render boom' }), {
      handheldBy: 'exposed-component-error-boundary',
      component: 'Entity Metrics',
    });
  });

  it('shows the correct component name in the error message', () => {
    render(
      <ExposedComponentErrorBoundary boundaryName="test-boundary" componentName="Mini Breakdown">
        <ThrowingChild error={new Error('oops')} />
      </ExposedComponentErrorBoundary>
    );

    expect(
      screen.getByText('Mini Breakdown failed to load. Please try again or contact your organization admin.')
    ).toBeInTheDocument();
  });

  it('handles error without message gracefully', () => {
    const error = new Error();
    error.message = '';

    render(
      <ExposedComponentErrorBoundary boundaryName="test-boundary" componentName="Test Component">
        <ThrowingChild error={error} />
      </ExposedComponentErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
