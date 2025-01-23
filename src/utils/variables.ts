import { ConstantVariable, SceneTimeRange, SceneTimeRangeLike, SceneVariable } from '@grafana/scenes';

export function isConstantVariable(variable: SceneVariable | null): variable is ConstantVariable {
  return variable !== null && variable.state.type === 'constant';
}

//won't be a variable. might go into separate file utils/timerange.ts. need to do things a lil differently. SceneVariable is a superset of diff var types. SceneVariable is base type. AdHoc extends, etc. go to def for SceneTimeRange, see SceneTimeRangeLike.
// look at type for it. what are the things we actually care about being on this thing. how can we check for it?
export function isSceneTimeRange(input: SceneTimeRangeLike | null): input is SceneTimeRange {
  return input !== null && 'from' in input.state && 'to' in input.state;
}

export function isAdHocFiltersVariable(variable: SceneVariable | null): variable is SceneVariable {
  return variable !== null && variable.state.type === 'adhoc';
}
