export const CHROMIUM_VIEWPORT = { width: 1920, height: 1080 };

// taken from Grafana
// see https://github.com/grafana/grafana/blob/852d032e1ae1f7c989d8b2ec7d8e05bf2a54928e/public/app/core/components/AppChrome/AppChromeService.tsx#L32-L33
export const DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY = 'grafana.navigation.open';
export const DOCKED_MENU_DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.docked';

export const DEFAULT_STATIC_URL_SEARCH_PARAMS = new URLSearchParams({
  from: '2025-02-18T13:30:00.000Z',
  to: '2025-02-18T16:15:00.000Z',
  timezone: 'utc',
});

export const DEFAULT_URL_SEARCH_PARAMS = new URLSearchParams({
  from: 'now-15m',
  to: 'now',
  'var-ds': 'gdev-prometheus',
});
