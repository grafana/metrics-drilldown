import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { compare } from 'compare-versions';

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

export function getAppBackgroundColor(theme: GrafanaTheme2, embedded?: boolean): string | undefined {
  if (embedded) {
    // Embedded consumers (e.g. RCA workbench) provide their own host page chrome, which isn't
    // guaranteed to paint the same background Grafana's <Page> would, so we always self-paint here.
    // Independent of the toggle: background.page and background.primary are the same token, and
    // canvas is meaningfully darker, so this must not fall through to canvas when the toggle is off.
    return theme.colors.background.page;
  }

  // Standalone app route: Grafana's own Page paints the background for us when the toggle is on.
  //@ts-expect-error
  return theme.flags.visualDesignRefresh ? theme.colors.background.page : theme.colors.background.canvas;
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
