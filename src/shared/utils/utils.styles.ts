import { type GrafanaTheme2 } from '@grafana/data';

import { type DataTrail } from 'AppDataTrail/DataTrail';

export function getAppBackgroundColor(theme: GrafanaTheme2, trail?: DataTrail): string {
  // If DataTrail is in embedded mode, always use primary background
  if (trail?.state.embedded) {
    return theme.colors.background.primary;
  }

  // Otherwise, use the standard theme-based logic
  return theme.isLight ? theme.colors.background.primary : theme.colors.background.canvas;
}

/**
 * Returns CSS styles for making a panel clickable with proper cursor and hover feedback.
 * Includes an invisible overlay to ensure cursor shows over entire panel area.
 */
export function getClickablePanelStyles(theme: GrafanaTheme2): string {
  return `
    position: relative;
    cursor: pointer;
    &:hover {
      background: ${theme.colors.background.secondary};
    }
    /* Invisible overlay covering entire panel - z-index ensures it's above panel content */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      cursor: inherit;
      z-index: 1;
    }
  `;
}
