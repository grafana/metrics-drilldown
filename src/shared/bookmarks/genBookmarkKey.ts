import { type SceneObjectUrlValues } from '@grafana/scenes';

function filterUrlValues(urlValues: SceneObjectUrlValues) {
  delete urlValues.actionView;
  delete urlValues.layout;
  delete urlValues.refresh;

  if (Array.isArray(urlValues['var-filters'])) {
    urlValues['var-filters'] = urlValues['var-filters'].filter(Boolean);
  }

  return urlValues;
}

export function genBookmarkKey(urlValues: SceneObjectUrlValues) {
  // exemplars is left out of the key so that toggling it does not change which bookmark a view matches.
  // It is removed from a copy, not from urlValues: callers save and restore the same object, so a bookmark
  // saved with exemplars on has to keep the param.
  const keyValues = { ...filterUrlValues(urlValues) };
  delete keyValues.exemplars;

  return JSON.stringify(keyValues);
}
