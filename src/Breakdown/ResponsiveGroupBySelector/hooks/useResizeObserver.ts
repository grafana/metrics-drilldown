import { useEffect, useRef, useState } from 'react';

/**
 * Hook to monitor container width changes using ResizeObserver
 * @param debounceMs - Debounce delay for resize events (default: 100ms)
 * @returns Object with containerRef and current availableWidth
 */
export function useResizeObserver(debounceMs = 100) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const element = entries[0]?.target as HTMLElement;
      if (element) {
        // Debounce the width updates to avoid excessive re-renders
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          setAvailableWidth(element.clientWidth);
        }, debounceMs);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      // Set initial width
      setAvailableWidth(containerRef.current.clientWidth);
    }

    return () => {
      resizeObserver.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debounceMs]);

  return { containerRef, availableWidth };
}
