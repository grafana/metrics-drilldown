import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';

/**
 * Shared styles for list components in the sidebar sections.
 * Used by CheckBoxList, TreeCheckBoxList, and other list-based components.
 */
export function getSharedListStyles(theme: GrafanaTheme2) {
  return {
    listHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      padding: theme.spacing(0, 0, 0, 1),
    }),
    list: css({
      height: '100%',
      padding: theme.spacing(0, 1, 1, 1),
      overflowY: 'auto',
      listStyle: 'none',
      margin: 0,
      '&::-webkit-scrollbar': {
        WebkitAppearance: 'none',
        width: '7px',
      },
      '&::-webkit-scrollbar-thumb': {
        borderRadius: '4px',
        backgroundColor: theme.colors.secondary.main,
        WebkitBoxShadow: `0 0 1px ${theme.colors.secondary.shade}`,
      },
    }),
    listItem: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0.5, 0),
    }),
    noResults: css({
      fontStyle: 'italic',
      padding: theme.spacing(0, 1, 1, 1),
    }),
  };
}
