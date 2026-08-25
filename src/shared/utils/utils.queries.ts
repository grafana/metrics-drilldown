import { type AdHocVariableFilter } from '@grafana/data';
import { utf8Support } from '@grafana/prometheus';
import { type SceneObject, type SceneQueryRunner } from '@grafana/scenes';

export function isSceneQueryRunner(input: SceneObject | null | undefined): input is SceneQueryRunner {
  return typeof input !== 'undefined' && input !== null && 'state' in input && 'runQueries' in input;
}

/**
 * Escapes a value for safe interpolation inside a PromQL string literal (doubles backslashes, then
 * escapes double quotes). Safe to apply regardless of whether the value is a plain string or a regex
 * pattern: this only concerns the outer string-literal delimiters, not regex metacharacter semantics,
 * so it doesn't interfere with a caller that already escaped those separately.
 */
export function escapePromQLString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
  // Values come directly from arbitrary Prometheus label values (typed by a user, or built from
  // multiple selected values into a regex alternation elsewhere), not from a trusted, pre-escaped
  // source. A literal `"` would otherwise break out of the string literal below and corrupt the query.
  return `${key}${filter.operator}"${escapePromQLString(filter.value)}"`;
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
