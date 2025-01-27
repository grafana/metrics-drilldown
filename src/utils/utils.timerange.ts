import { SceneObject, SceneObjectState, SceneTimeRange, SceneTimeRangeState } from '@grafana/scenes';

export function isSceneTimeRange(input: SceneObject | null | undefined): input is SceneTimeRange {
  return typeof input !== 'undefined' && input !== null && 'getTimeZone' in input && isSceneTimeRangeState(input.state);
}

export function isSceneTimeRangeState(input: SceneObjectState | null | undefined): input is SceneTimeRangeState {
  return typeof input !== 'undefined' && input !== null && 'value' in input && 'from' in input && 'to' in input;
}
