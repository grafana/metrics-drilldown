import type React from 'react';

/**
 * @deprecated No-op shim retained for exposed-component compatibility.
 * Exposed components still import this hook; a follow-up will give them
 * their own error boundary.
 */
export function useCatchExceptions(): [Error | undefined, React.Dispatch<React.SetStateAction<Error | undefined>>] {
  return [undefined, () => {}];
}

export { ensureErrorObject } from './errorUtils';
