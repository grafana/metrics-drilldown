import { type GrafanaTheme2 } from '@grafana/data';

import { type DataTrail } from 'DataTrail';

export function getAppBackgroundColor(theme: GrafanaTheme2, trail?: DataTrail): string {
  // If DataTrail is in embedded mode, always use primary background
  if (trail?.state.embedded) {
    return theme.colors.background.primary;
  }

  // Otherwise, use the standard theme-based logic
  return theme.isLight ? theme.colors.background.primary : theme.colors.background.canvas;
}
