import { type SceneObjectUrlValues } from '@grafana/scenes';

import { type Bookmark } from './useBookmarks';

function correctUrlStateForComparison(urlState: SceneObjectUrlValues) {
  // Omit some URL parameters that are not useful for state comparison,
  // as they can change in the URL without creating new steps
  delete urlState.actionView;
  delete urlState.layout;
  delete urlState.metricSearch;
  delete urlState.refresh;

  // Populate defaults
  if (urlState['var-groupby'] === '' || urlState['var-groupby'] === undefined) {
    urlState['var-groupby'] = '$__all';
  }

  if (typeof urlState['var-filters'] !== 'string') {
    urlState['var-filters'] = urlState['var-filters']?.filter((filter) => filter !== '');
  }

  return urlState;
}

export function genBookmarkKey(urlValues: Bookmark['urlValues']) {
  return JSON.stringify(correctUrlStateForComparison(urlValues));
}
