import { SceneLayout, SceneCSSGridLayout, SceneFlexLayout } from '@grafana/scenes';

type MaybeLayout = SceneLayout | null | undefined;

export function isSceneCSSGridLayout(input: MaybeLayout): input is SceneCSSGridLayout {
  return typeof input !== 'undefined' && input !== null && 'isDraggable' in input && 'templateColumns' in input.state;
}

export function isSceneFlexLayout(input: MaybeLayout): input is SceneFlexLayout {
  return typeof input !== 'undefined' && input !== null && 'toggleDirection' in input && 'children' in input.state;
}
