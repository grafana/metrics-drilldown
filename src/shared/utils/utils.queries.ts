import { type AdHocVariableFilter } from '@grafana/data';
import { utf8Support } from '@grafana/prometheus';
import { type SceneObject, type SceneQueryRunner } from '@grafana/scenes';

export function isSceneQueryRunner(input: SceneObject | null | undefined): input is SceneQueryRunner {
  return typeof input !== 'undefined' && input !== null && 'state' in input && 'runQueries' in input;
}

/**
 * Builds a PromQL label matcher string from an AdHocVariableFilter.
 * Normalizes empty and double-quoted empty filter values to produce
 * a valid empty string matcher (e.g. `label!=""`) instead of the
 * malformed `label!=""""`.
 */
export function buildFilterExpression(filter: AdHocVariableFilter): string {
  const key = utf8Support(filter.key);
  if (filter.value === '' || filter.value === '""') {
    return `${key}${filter.operator}""`;
  }
  return `${key}${filter.operator}"${filter.value}"`;
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
