import { useEffect, useRef, type RefObject } from 'react';

interface UseResizeObserverOptions {
  ref: RefObject<Element | null>;
  onResize: () => void;
}

export function useResizeObserver({ ref, onResize }: UseResizeObserverOptions): void {
  const callbackRef = useRef(onResize);

  useEffect(() => {
    callbackRef.current = onResize;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(() => {
      callbackRef.current();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
}
