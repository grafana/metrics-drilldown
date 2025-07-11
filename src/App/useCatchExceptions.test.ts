import { renderHook } from '@testing-library/react';
import { act } from 'react';

import { useCatchExceptions } from './useCatchExceptions';
import { logger } from '../tracking/logger/logger';

// Mock the logger
jest.mock('../tracking/logger/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('useCatchExceptions', () => {
  const mockLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should filter out browser extension errors and log them', () => {
    const { result } = renderHook(() => useCatchExceptions());

    // Simulate a browser extension error
    const browserExtensionError = new ErrorEvent('error', {
      message: 'Failed to execute appendChild on Node',
      filename: 'chrome-extension://some-extension-id/something.html',
      lineno: 13,
      colno: 35,
      error: new Error('TypeError: Failed to execute appendChild on Node'),
    });

    // Trigger the error event
    act(() => {
      window.dispatchEvent(browserExtensionError);
    });

    // The error should be logged but not set as an application error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Browser extension error: Failed to execute appendChild on Node',
      }),
      expect.objectContaining({
        filename: 'chrome-extension://some-extension-id/something.html',
        lineno: '13',
        colno: '35',
      })
    );

    // The error state should remain undefined
    expect(result.current[0]).toBeUndefined();
  });

  it('should filter out null error events with messages and log them', () => {
    const { result } = renderHook(() => useCatchExceptions());

    // Simulate a ResizeObserver error
    const resizeObserverError = new ErrorEvent('error', {
      message: 'ResizeObserver loop completed with undelivered notifications.',
      filename: 'https://example.com/app.js',
      lineno: 42,
      colno: 10,
      error: null,
    });

    // Trigger the error event
    act(() => {
      window.dispatchEvent(resizeObserverError);
    });

    // The error should be logged but not set as an application error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Non-critical error: ResizeObserver loop completed with undelivered notifications.',
      }),
      expect.objectContaining({
        filename: 'https://example.com/app.js',
        lineno: '42',
        colno: '10',
      })
    );

    // The error state should remain undefined
    expect(result.current[0]).toBeUndefined();
  });

  it('should catch legitimate application errors', () => {
    const { result } = renderHook(() => useCatchExceptions());

    // Simulate a legitimate application error (not from browser extension and not null error)
    const appError = new ErrorEvent('error', {
      message: 'Cannot read property of undefined',
      filename: 'https://example.com/app.js',
      lineno: 100,
      colno: 5,
      error: new Error('TypeError: Cannot read property of undefined'),
    });

    // Trigger the error event
    act(() => {
      window.dispatchEvent(appError);
    });

    // The error should be set as an application error
    expect(result.current[0]).toBeInstanceOf(Error);
    expect(result.current[0]?.message).toBe('TypeError: Cannot read property of undefined');
  });
});
