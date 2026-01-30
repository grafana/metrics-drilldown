import { t } from '@grafana/i18n';

// These constants are used at top-level and cannot be directly translated.
// Translation happens at render time via the functions below.
export const UI_TEXT = {
  SEARCH: {
    TITLE: 'Search metrics',
  },
  METRIC_SELECT_SCENE: {
    OPEN_EXPLORE_LABEL: 'Open in explore',
    COPY_URL_LABEL: 'Copy url',
    BOOKMARK_LABEL: 'Bookmark',
    SELECT_NEW_METRIC_TOOLTIP: 'Remove existing metric and choose a new metric',
  },
};

// Use these functions inside React components to get translated strings
export function getTranslatedUIText() {
  return {
    SEARCH: {
      TITLE: t('ui-text.search.title', 'Search metrics'),
    },
    METRIC_SELECT_SCENE: {
      OPEN_EXPLORE_LABEL: t('ui-text.metric-select.open-explore', 'Open in explore'),
      COPY_URL_LABEL: t('ui-text.metric-select.copy-url', 'Copy url'),
      BOOKMARK_LABEL: t('ui-text.metric-select.bookmark', 'Bookmark'),
      SELECT_NEW_METRIC_TOOLTIP: t(
        'ui-text.metric-select.select-new-metric-tooltip',
        'Remove existing metric and choose a new metric'
      ),
    },
  };
}
