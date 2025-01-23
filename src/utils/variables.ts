import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  QueryVariable,
  SceneObject,
  SceneTimeRange,
  SceneVariable,
} from '@grafana/scenes';

type MaybeVariable = SceneVariable | null | undefined;

export function isConstantVariable(variable: MaybeVariable): variable is ConstantVariable {
  return variable !== null && variable?.state.type === 'constant';
}

export function isAdHocFiltersVariable(variable: MaybeVariable): variable is AdHocFiltersVariable {
  return variable !== null && variable?.state.type === 'adhoc';
}

export function isCustomVariable(variable: MaybeVariable): variable is CustomVariable {
  return variable !== null && variable?.state.type === 'custom';
}

export function isQueryVariable(variable: MaybeVariable): variable is QueryVariable {
  return variable !== null && variable?.state.type === 'query';
}

export function isSceneTimeRange(input: SceneObject | null | undefined): input is SceneTimeRange {
  return (
    typeof input !== 'undefined' &&
    input !== null &&
    'getTimeZone' in input &&
    'from' in input.state &&
    'to' in input.state
  );
}
