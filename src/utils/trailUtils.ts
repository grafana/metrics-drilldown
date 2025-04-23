import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import { type DataTrailInterface } from '../types/dataTrail';

export function getTrailFor<T extends SceneObject>(model: T): DataTrailInterface | undefined {
  return sceneGraph.getAncestor(model, DataTrail) as DataTrailInterface | undefined;
}
