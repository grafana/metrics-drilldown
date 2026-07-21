import { render, screen } from '@testing-library/react';
import React from 'react';

import { InlineBanner } from './InlineBanner';
import { logger } from '../shared/logger/logger';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InlineBanner', () => {
  it('renders without error prop', () => {
    render(<InlineBanner severity="info" title="Info" message="All good" />);

    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('logs error exactly once on initial render', () => {
    const error = new Error('query failed');

    render(<InlineBanner severity="error" title="Error" error={error} />);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'query failed' }),
      expect.objectContaining({ bannerTitle: 'Error' })
    );
  });

  it('does not log again on re-render with the same error', () => {
    const error = new Error('query failed');

    const { rerender } = render(<InlineBanner severity="error" title="Error" error={error} />);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);

    rerender(<InlineBanner severity="error" title="Error" error={error} />);
    rerender(<InlineBanner severity="error" title="Error" error={error} />);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it('logs again when error changes', () => {
    const error1 = new Error('first error');
    const error2 = new Error('second error');

    const { rerender } = render(<InlineBanner severity="error" title="Error" error={error1} />);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);

    rerender(<InlineBanner severity="error" title="Error" error={error2} />);

    expect(mockLogger.error).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'second error' }),
      expect.objectContaining({ bannerTitle: 'Error' })
    );
  });

  it('displays the formatted error message', () => {
    const error = new Error('Something broke');

    render(<InlineBanner severity="error" title="Error" error={error} />);

    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('displays HTTP status in error message when available', () => {
    const error = Object.assign(new Error('Request failed'), { status: 500, statusText: 'Internal Server Error' });

    render(<InlineBanner severity="error" title="Error" error={error} />);

    expect(screen.getByText('Request failed (Internal Server Error - HTTP 500)')).toBeInTheDocument();
  });
});
