// React Router 6.30.6 fixes GHSA-jjmj-jmhj-qwj2 but remains affected by
// GHSA-wrjc-x8rr-h8h6, which can treat backslash-prefixed values as external URLs.
export function normalizeInternalPathname(pathname: string): string {
  return `/${pathname.replaceAll('\\', '/').replace(/^\/+/, '')}`;
}
