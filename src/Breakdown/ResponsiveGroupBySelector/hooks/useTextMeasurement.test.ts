import { measureText } from '@grafana/ui';
import { renderHook } from '@testing-library/react';

import { useTextMeasurement } from './useTextMeasurement';

// Mock the measureText function
jest.mock('@grafana/ui', () => ({
  measureText: jest.fn(),
}));

const mockMeasureText = measureText as jest.MockedFunction<typeof measureText>;

describe('useTextMeasurement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation
    mockMeasureText.mockReturnValue({ width: 100 } as TextMetrics);
  });

  it('should return a memoized function that measures text width', () => {
    const { result } = renderHook(() => useTextMeasurement(14));

    expect(typeof result.current).toBe('function');
  });

  it('should call measureText with correct parameters', () => {
    const { result } = renderHook(() => useTextMeasurement(16));

    const testText = 'Hello World';
    result.current(testText);

    expect(mockMeasureText).toHaveBeenCalledWith(testText, 16);
  });

  it('should return the width from measureText', () => {
    mockMeasureText.mockReturnValue({ width: 150 } as TextMetrics);

    const { result } = renderHook(() => useTextMeasurement(16));

    const width = result.current('Test text');

    expect(width).toBe(150);
  });

  it('should memoize the function based on fontSize', () => {
    const { result, rerender } = renderHook(
      ({ fontSize }) => useTextMeasurement(fontSize),
      { initialProps: { fontSize: 14 } }
    );

    const firstFunction = result.current;

    // Re-render with same fontSize
    rerender({ fontSize: 14 });
    const secondFunction = result.current;

    // Should be the same function reference (memoized)
    expect(firstFunction).toBe(secondFunction);
  });

  it('should create new function when fontSize changes', () => {
    const { result, rerender } = renderHook(
      ({ fontSize }) => useTextMeasurement(fontSize),
      { initialProps: { fontSize: 14 } }
    );

    const firstFunction = result.current;

    // Re-render with different fontSize
    rerender({ fontSize: 16 });
    const secondFunction = result.current;

    // Should be different function references
    expect(firstFunction).not.toBe(secondFunction);
  });

  it('should work with different font sizes', () => {
    mockMeasureText
      .mockReturnValueOnce({ width: 100 } as TextMetrics)
      .mockReturnValueOnce({ width: 120 } as TextMetrics);

    const { result: result14 } = renderHook(() => useTextMeasurement(12));
    const { result: result16 } = renderHook(() => useTextMeasurement(16));

    const testText = 'Same text';

    const width12 = result14.current(testText);
    const width16 = result16.current(testText);

    expect(mockMeasureText).toHaveBeenNthCalledWith(1, testText, 12);
    expect(mockMeasureText).toHaveBeenNthCalledWith(2, testText, 16);
    expect(width12).toBe(100);
    expect(width16).toBe(120);
  });

  it('should handle empty strings', () => {
    mockMeasureText.mockReturnValue({ width: 0 } as TextMetrics);

    const { result } = renderHook(() => useTextMeasurement(14));

    const width = result.current('');

    expect(mockMeasureText).toHaveBeenCalledWith('', 14);
    expect(width).toBe(0);
  });

  it('should handle special characters and unicode', () => {
    mockMeasureText.mockReturnValue({ width: 75 } as TextMetrics);

    const { result } = renderHook(() => useTextMeasurement(14));

    const specialText = '🚀 Special! @#$%';
    const width = result.current(specialText);

    expect(mockMeasureText).toHaveBeenCalledWith(specialText, 14);
    expect(width).toBe(75);
  });

  it('should work with long text strings', () => {
    const longText = 'This is a very long text string that might be used as a label name in some scenarios';
    mockMeasureText.mockReturnValue({ width: 500 } as TextMetrics);

    const { result } = renderHook(() => useTextMeasurement(14));

    const width = result.current(longText);

    expect(mockMeasureText).toHaveBeenCalledWith(longText, 14);
    expect(width).toBe(500);
  });

  it('should maintain consistent behavior across multiple calls', () => {
    mockMeasureText.mockReturnValue({ width: 80 } as TextMetrics);

    const { result } = renderHook(() => useTextMeasurement(14));

    const text = 'Consistent';
    const width1 = result.current(text);
    const width2 = result.current(text);
    const width3 = result.current(text);

    expect(width1).toBe(80);
    expect(width2).toBe(80);
    expect(width3).toBe(80);
    expect(mockMeasureText).toHaveBeenCalledTimes(3);
  });

  it('should handle floating point font sizes', () => {
    mockMeasureText.mockReturnValue({ width: 95.5 } as TextMetrics);

    const { result } = renderHook(() => useTextMeasurement(13.5));

    const width = result.current('Float size');

    expect(mockMeasureText).toHaveBeenCalledWith('Float size', 13.5);
    expect(width).toBe(95.5);
  });
});
