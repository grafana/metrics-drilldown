import { act, renderHook } from '@testing-library/react';

import { useResizeObserver } from './useResizeObserver';

describe('useResizeObserver', () => {
  let mockResizeObserver: jest.MockedClass<typeof ResizeObserver>;
  let mockObserve: jest.Mock;
  let mockUnobserve: jest.Mock;
  let mockDisconnect: jest.Mock;

  beforeEach(() => {
    mockObserve = jest.fn();
    mockUnobserve = jest.fn();
    mockDisconnect = jest.fn();

    mockResizeObserver = jest.fn().mockImplementation((callback) => ({
      observe: mockObserve,
      unobserve: mockUnobserve,
      disconnect: mockDisconnect,
      callback,
    }));

    global.ResizeObserver = mockResizeObserver;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should return containerRef and initial availableWidth of 0', () => {
    const { result } = renderHook(() => useResizeObserver());

    expect(result.current.availableWidth).toBe(0);
    expect(result.current.containerRef).toBeDefined();
    expect(result.current.containerRef.current).toBeNull();
  });

  it('should observe container when ref is set', () => {
    const { result } = renderHook(() => useResizeObserver());

    // Simulate setting a ref
    const mockElement = {
      clientWidth: 500,
    } as HTMLDivElement;

    act(() => {
      // @ts-ignore - Setting current for testing
      result.current.containerRef.current = mockElement;
    });

    // Re-render to trigger useEffect
    renderHook(() => useResizeObserver());

    expect(mockResizeObserver).toHaveBeenCalled();
    expect(mockObserve).toHaveBeenCalledWith(mockElement);
  });

  it('should set initial width when container ref is set', () => {
    const { result, rerender } = renderHook(() => useResizeObserver());

    const mockElement = {
      clientWidth: 500,
    } as HTMLDivElement;

    act(() => {
      // @ts-ignore - Setting current for testing
      result.current.containerRef.current = mockElement;
    });

    rerender();

    expect(result.current.availableWidth).toBe(500);
  });

  it('should update width when ResizeObserver fires', () => {
    const { result, rerender } = renderHook(() => useResizeObserver());

    const mockElement = {
      clientWidth: 500,
    } as HTMLDivElement;

    act(() => {
      // @ts-ignore - Setting current for testing
      result.current.containerRef.current = mockElement;
    });

    rerender();

    // Get the callback passed to ResizeObserver
    const resizeCallback = mockResizeObserver.mock.calls[0][0];

    // Simulate resize event
    act(() => {
      const newMockElement = {
        clientWidth: 800,
      } as HTMLElement;

      resizeCallback([{ target: newMockElement } as unknown as ResizeObserverEntry], {} as ResizeObserver);

      // Fast-forward timers to trigger debounced update
      jest.advanceTimersByTime(100);
    });

    expect(result.current.availableWidth).toBe(800);
  });

  it('should debounce resize events with default 100ms delay', () => {
    const { result, rerender } = renderHook(() => useResizeObserver());

    const mockElement = {
      clientWidth: 500,
    } as HTMLDivElement;

    act(() => {
      // @ts-ignore - Setting current for testing
      result.current.containerRef.current = mockElement;
    });

    rerender();

    const resizeCallback = mockResizeObserver.mock.calls[0][0];

    // Simulate multiple rapid resize events
    act(() => {
      const element1 = { clientWidth: 600 } as HTMLElement;
      const element2 = { clientWidth: 700 } as HTMLElement;
      const element3 = { clientWidth: 800 } as HTMLElement;

      resizeCallback([{ target: element1 } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      resizeCallback([{ target: element2 } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      resizeCallback([{ target: element3 } as unknown as ResizeObserverEntry], {} as ResizeObserver);

      // Advance time by less than debounce delay
      jest.advanceTimersByTime(50);
    });

    // Width should still be the initial value
    expect(result.current.availableWidth).toBe(500);

    // Advance time to complete debounce
    act(() => {
      jest.advanceTimersByTime(60);
    });

    // Width should be updated to the last value
    expect(result.current.availableWidth).toBe(800);
  });

  it('should use custom debounce delay', () => {
    const { result, rerender } = renderHook(() => useResizeObserver(200));

    const mockElement = {
      clientWidth: 500,
    } as HTMLDivElement;

    act(() => {
      // @ts-ignore - Setting current for testing
      result.current.containerRef.current = mockElement;
    });

    rerender();

    const resizeCallback = mockResizeObserver.mock.calls[0][0];

    act(() => {
      const newElement = { clientWidth: 800 } as HTMLElement;
      resizeCallback([{ target: newElement } as unknown as ResizeObserverEntry], {} as ResizeObserver);

      // Advance by less than custom debounce delay
      jest.advanceTimersByTime(150);
    });

    // Should still be initial value
    expect(result.current.availableWidth).toBe(500);

    act(() => {
      // Advance by remaining time to complete custom debounce
      jest.advanceTimersByTime(60);
    });

    // Should be updated now
    expect(result.current.availableWidth).toBe(800);
  });

  it('should disconnect observer on unmount', () => {
    const { unmount } = renderHook(() => useResizeObserver());

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should clear timeout on unmount', () => {
    const { result, rerender, unmount } = renderHook(() => useResizeObserver());

    const mockElement = {
      clientWidth: 500,
    } as HTMLDivElement;

    act(() => {
      // @ts-ignore - Setting current for testing
      result.current.containerRef.current = mockElement;
    });

    rerender();

    const resizeCallback = mockResizeObserver.mock.calls[0][0];

    // Start a resize event but don't let it complete
    act(() => {
      const newElement = { clientWidth: 800 } as HTMLElement;
      resizeCallback([{ target: newElement } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    });

    // Unmount before debounce completes
    unmount();

    // Advance timers - the update should not happen
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should handle missing target element gracefully', () => {
    const { result, rerender } = renderHook(() => useResizeObserver());

    const mockElement = {
      clientWidth: 500,
    } as HTMLDivElement;

    act(() => {
      // @ts-ignore - Setting current for testing
      result.current.containerRef.current = mockElement;
    });

    rerender();

    const resizeCallback = mockResizeObserver.mock.calls[0][0];

    // Simulate resize event with no target
    act(() => {
      resizeCallback([], {} as ResizeObserver);
      jest.advanceTimersByTime(100);
    });

    // Width should remain unchanged
    expect(result.current.availableWidth).toBe(500);
  });

  it('should cancel previous timeout when new resize event occurs', () => {
    const { result, rerender } = renderHook(() => useResizeObserver());

    const mockElement = {
      clientWidth: 500,
    } as HTMLDivElement;

    act(() => {
      // @ts-ignore - Setting current for testing
      result.current.containerRef.current = mockElement;
    });

    rerender();

    const resizeCallback = mockResizeObserver.mock.calls[0][0];

    // First resize event
    act(() => {
      const element1 = { clientWidth: 600 } as HTMLElement;
      resizeCallback([{ target: element1 } as unknown as ResizeObserverEntry], {} as ResizeObserver);

      // Advance time partially
      jest.advanceTimersByTime(50);
    });

    // Second resize event before first completes
    act(() => {
      const element2 = { clientWidth: 800 } as HTMLElement;
      resizeCallback([{ target: element2 } as unknown as ResizeObserverEntry], {} as ResizeObserver);

      // Complete the debounce time
      jest.advanceTimersByTime(100);
    });

    // Should have the value from the second event, not the first
    expect(result.current.availableWidth).toBe(800);
  });
});
