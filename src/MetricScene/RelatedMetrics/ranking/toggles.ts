function getStorageValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function isJevEnabled(): boolean {
  return getStorageValue('gmd.jev.enabled') === '1';
}

export function isJevDebugEnabled(): boolean {
  return getStorageValue('gmd.jev.debug') === '1';
}
