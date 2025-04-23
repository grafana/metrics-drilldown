import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { DataTrail } from 'DataTrail';

import { type DataTrailSettings } from '../DataTrailSettings';

export function getTrailFor(model: SceneObject): DataTrail {
  return sceneGraph.getAncestor(model, DataTrail);
}

export function getTrailSettings(model: SceneObject): DataTrailSettings {
  return sceneGraph.getAncestor(model, DataTrail).state.settings;
}
