import { renderHook } from '@testing-library/react';
import { act } from 'react';

import { ensureErrorObject, useCatchExceptions } from './useCatchExceptions';
import { logger } from '../shared/logger/logger';

// Mock the logger
jest.mock('../shared/logger/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const makeRejectionEvent = (reason: unknown): PromiseRejectionEvent =>
  Object.assign(new Event('unhandledrejection'), {
    reason,
    promise: Promise.resolve(),
  }) as PromiseRejectionEvent;

describe('ensureErrorObject', () => {
  it('returns the same Error instance', () => {
    const originalError = new Error('test error');
    const result = ensureErrorObject(originalError, 'default');

    expect(result).toBe(originalError);
    expect(result.message).toBe('test error');
  });

  it('wraps a string in an Error', () => {
    const result = ensureErrorObject('string error', 'default');

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('string error');
  });

  it('creates an Error from an object with a message', () => {
    const errorLike = { message: 'object error' };
    const result = ensureErrorObject(errorLike, 'default');

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('object error');
  });

  it('falls back to default message when no message is present', () => {
    const result = ensureErrorObject(undefined, 'default message');

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('default message');
  });
});

describe('useCatchExceptions', () => {
  const mockLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters browser extension errors and logs them', () => {
    const { result } = renderHook(() => useCatchExceptions());

    const browserExtensionError = new ErrorEvent('error', {
      message: 'Failed to execute appendChild on Node',
      filename: 'chrome-extension://some-extension-id/something.html',
      lineno: 13,
      colno: 35,
      error: new Error('TypeError: Failed to execute appendChild on Node'),
    });

    act(() => {
      window.dispatchEvent(browserExtensionError);
    });

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
    expect(result.current[0]).toBeUndefined();
  });

  it('filters null error events with messages and logs them', () => {
    const { result } = renderHook(() => useCatchExceptions());

    const resizeObserverError = new ErrorEvent('error', {
      message: 'ResizeObserver loop completed with undelivered notifications.',
      filename: 'https://example.com/app.js',
      lineno: 42,
      colno: 10,
      error: null,
    });

    act(() => {
      window.dispatchEvent(resizeObserverError);
    });

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
    expect(result.current[0]).toBeUndefined();
  });

  it('catches legitimate application errors', () => {
    const { result } = renderHook(() => useCatchExceptions());

    const appError = new ErrorEvent('error', {
      message: 'Cannot read property of undefined',
      filename: 'https://example.com/app.js',
      lineno: 100,
      colno: 5,
      error: new Error('TypeError: Cannot read property of undefined'),
    });

    act(() => {
      window.dispatchEvent(appError);
    });

    expect(result.current[0]).toBeInstanceOf(Error);
    expect(result.current[0]?.message).toBe('TypeError: Cannot read property of undefined');
  });

  it('handles error events where error property is undefined', () => {
    const { result } = renderHook(() => useCatchExceptions());

    const errorEvent = new ErrorEvent('error', {
      message: 'Script error',
      filename: 'https://example.com/app.js',
      lineno: 50,
      colno: 10,
    });

    act(() => {
      window.dispatchEvent(errorEvent);
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Non-critical error: Script error',
      }),
      expect.objectContaining({
        filename: 'https://example.com/app.js',
      })
    );
    expect(result.current[0]).toBeUndefined();
  });

  it('clears error on cancelled unhandled rejection', () => {
    const { result } = renderHook(() => useCatchExceptions());

    const rejectionEvent = makeRejectionEvent({ type: 'cancelled' });

    act(() => {
      window.dispatchEvent(rejectionEvent);
    });

    expect(result.current[0]).toBeUndefined();
  });

  it('sets error from unhandled rejection with message', () => {
    const { result } = renderHook(() => useCatchExceptions());

    const rejectionEvent = makeRejectionEvent('Something went wrong');

    act(() => {
      window.dispatchEvent(rejectionEvent);
    });

    expect(result.current[0]).toBeInstanceOf(Error);
    expect(result.current[0]?.message).toBe('Something went wrong');
  });

  it('sets default error when unhandled rejection reason is missing', () => {
    const { result } = renderHook(() => useCatchExceptions());

    const rejectionEvent = makeRejectionEvent(undefined);

    act(() => {
      window.dispatchEvent(rejectionEvent);
    });

    expect(result.current[0]).toBeInstanceOf(Error);
    expect(result.current[0]?.message).toBe('Unhandled rejection!');
  });
});
