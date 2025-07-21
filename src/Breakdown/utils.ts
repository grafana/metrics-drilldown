import { sceneGraph, type SceneObject } from '@grafana/scenes';

interface Type<T> extends Function {
  new (...args: any[]): T;
}

export function findSceneObjectByType<T extends SceneObject>(scene: SceneObject, sceneType: Type<T>) {
  const targetScene = sceneGraph.findObject(scene, (obj) => obj instanceof sceneType);

  if (targetScene instanceof sceneType) {
    return targetScene;
  }

  return null;
}

export function findSceneObjectsByType<T extends SceneObject>(scene: SceneObject, sceneType: Type<T>) {
  function isSceneType(scene: SceneObject): scene is T {
    return scene instanceof sceneType;
  }

  const targetScenes = sceneGraph.findAllObjects(scene, isSceneType);
  return targetScenes.filter(isSceneType);
}
