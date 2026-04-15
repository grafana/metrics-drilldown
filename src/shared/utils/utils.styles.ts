import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { compare } from 'compare-versions';

import { type DataTrail } from 'AppDataTrail/DataTrail';

const CONTAINER_QUERIES_MIN_VERSION = '12.4.0';
const supportsContainerQueries = !compare(config.buildInfo.version ?? '0.0.0', CONTAINER_QUERIES_MIN_VERSION, '<');

/**
 * Returns the appropriate breakpoints API based on Grafana version.
 * Uses container queries (theme.breakpoints.container) for Grafana >=12.4.0,
 * and falls back to viewport-based breakpoints (theme.breakpoints) for older versions.
 */
export function getResponsiveBreakpoints(theme: GrafanaTheme2) {
  return supportsContainerQueries ? theme.breakpoints.container : theme.breakpoints;
}

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
