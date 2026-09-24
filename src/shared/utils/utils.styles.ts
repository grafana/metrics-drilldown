import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { compare } from 'compare-versions';

// TODO(2026-10-18): grafanaDependency is now >=13.1.0, so this is always true. Remove supportsContainerQueries and
// the ternary in getResponsiveBreakpoints below; always return theme.breakpoints.container.
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
    // Embedded consumers (e.g. RCA workbench) are drawers/panels floating on top of a page, not a
    // page themselves -- their own chrome is built at the "content pane" level, not the "page" level.
    // Confirmed live in the "Visual Refresh (Dark)" theme (flag on): background.page (#090b0f) and
    // background.primary (#111419) are genuinely different colors there (unlike the pre-refresh theme,
    // where they happened to match) -- primary is the one that actually matches the host's own chrome.
    return theme.colors.background.primary;
  }

  // Standalone app route: our own component IS the page here (rendered via Grafana's <Page>), so it
  // should match the page-level token, not the content-pane one.
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
