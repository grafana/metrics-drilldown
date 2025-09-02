import { type SceneObjectUrlValues } from '@grafana/scenes';

function filterUrlValues(urlValues: SceneObjectUrlValues) {
  delete urlValues.actionView;
  delete urlValues.layout;
  delete urlValues.metricSearch;
  delete urlValues.refresh;

  if (typeof urlValues['var-filters'] !== 'string') {
    urlValues['var-filters'] = urlValues['var-filters']?.filter(Boolean);
  }

  return urlValues;
}

export function genBookmarkKey(urlValues: SceneObjectUrlValues) {
  return JSON.stringify(filterUrlValues(urlValues));
}
