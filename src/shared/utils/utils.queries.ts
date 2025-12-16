import { type SceneObject, type SceneQueryRunner } from '@grafana/scenes';

export function isSceneQueryRunner(input: SceneObject | null | undefined): input is SceneQueryRunner {
  return typeof input !== 'undefined' && input !== null && 'state' in input && 'runQueries' in input;
}

/**
 * Removes the __ignore_usage__ label from a PromQL query expression.
 * This label is used internally by Metrics Drilldown and should be stripped
 * when sharing queries externally (e.g., Explore, Assistant, Add to Dashboard).
 */
export function removeIgnoreUsageLabel(query: string): string {
  if (query.includes('__ignore_usage__')) {
    return query.replace(/,?__ignore_usage__="",?/, '');
  }
  return query;
}
