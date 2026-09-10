// React Router v6 can interpret protocol-relative and backslash-prefixed values as external URLs.
export function normalizeInternalPathname(pathname: string): string {
  return `/${pathname.replaceAll('\\', '/').replace(/^\/+/, '')}`;
}
