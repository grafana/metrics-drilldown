import { type SceneDataTransformer, type SceneObject, type SceneQueryRunner } from '@grafana/scenes';

export function getQueryRunnerFor(sceneObject: SceneObject | undefined): SceneQueryRunner | undefined {
  if (!sceneObject) {
    return undefined;
  }

  const dataProvider = sceneObject.state.$data ?? sceneObject.parent?.state.$data;

  if (isSceneQueryRunner(dataProvider)) {
    return dataProvider;
  }

  if (isSceneDataTransformer(dataProvider)) {
    return getQueryRunnerFor(dataProvider);
  }

  return undefined;
}

export function isSceneQueryRunner(input: SceneObject | null | undefined): input is SceneQueryRunner {
  return typeof input !== 'undefined' && input !== null && 'state' in input && 'runQueries' in input;
}

export function isSceneDataTransformer(input: SceneObject | null | undefined): input is SceneDataTransformer {
  return typeof input !== 'undefined' && input !== null && 'state' in input && 'transformations' in input.state;
}
