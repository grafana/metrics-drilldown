import { AdHocFiltersVariable, ConstantVariable, SceneObject, SceneTimeRange, SceneVariable } from '@grafana/scenes';

type MaybeVariable = SceneVariable | null | undefined;

export function isConstantVariable(variable: MaybeVariable): variable is ConstantVariable {
  return variable !== null && variable?.state.type === 'constant';
}

export function isAdHocFiltersVariable(variable: MaybeVariable): variable is AdHocFiltersVariable {
  return variable !== null && variable?.state.type === 'adhoc';
}

//won't be a variable. might go into separate file utils/timerange.ts. need to do things a lil differently. SceneVariable is a superset of diff var types. SceneVariable is base type. AdHoc extends, etc. go to def for SceneTimeRange, see SceneTimeRangeLike.
// look at type for it. what are the things we actually care about being on this thing. how can we check for it?

export function isSceneTimeRange(input: SceneObject | null | undefined): input is SceneTimeRange {
  return (
    typeof input !== 'undefined' &&
    input !== null &&
    'getTimeZone' in input &&
    'from' in input.state &&
    'to' in input.state
  );
}
