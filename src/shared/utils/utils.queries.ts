import { type SceneObject, type SceneQueryRunner } from '@grafana/scenes';

export function isSceneQueryRunner(input: SceneObject | null | undefined): input is SceneQueryRunner {
  return typeof input !== 'undefined' && input !== null && 'state' in input && 'runQueries' in input;
}
