import { useCallback } from 'react';
import { measureText } from '@grafana/ui';

/**
 * Hook for measuring text width using Grafana's measureText utility
 * @param fontSize - Font size in pixels for text measurement
 * @returns Memoized function to measure text width
 */
export function useTextMeasurement(fontSize: number) {
  return useCallback((text: string): number => {
    return measureText(text, fontSize).width;
  }, [fontSize]);
}
