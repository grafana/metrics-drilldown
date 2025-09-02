import {
  type AdHocFiltersVariable,
  type CustomVariable,
  type QueryVariable,
  type SceneVariable,
} from '@grafana/scenes';

type MaybeVariable = SceneVariable | null | undefined;

export function isAdHocFiltersVariable(variable: MaybeVariable): variable is AdHocFiltersVariable {
  return variable !== null && variable !== undefined && variable?.state?.type === 'adhoc';
}

export function isCustomVariable(variable: MaybeVariable): variable is CustomVariable {
  return variable !== null && variable !== undefined && variable?.state?.type === 'custom';
}

export function isQueryVariable(variable: MaybeVariable): variable is QueryVariable {
  return variable !== null && variable !== undefined && variable?.state?.type === 'query';
}
