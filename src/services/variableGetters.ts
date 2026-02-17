import { DataSourceVariable, sceneGraph, SceneObject } from '@grafana/scenes';

import { VAR_DATASOURCE } from '../shared/shared';

export function getDataSourceVariable(scene: SceneObject): DataSourceVariable {
  const variable = sceneGraph.lookupVariable(VAR_DATASOURCE, scene);
  if (!(variable instanceof DataSourceVariable)) {
    throw new Error('VAR_DATASOURCE not found');
  }
  return variable;
}

export function getDataSourceUid(scene: SceneObject): string {
  const dsVariable = getDataSourceVariable(scene);
  return dsVariable.getValue().toString();
}
