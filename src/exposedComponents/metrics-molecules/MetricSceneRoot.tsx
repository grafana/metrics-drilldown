import { SceneObjectBase, type SceneComponentProps, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import React from 'react';

interface MetricSceneRootState extends SceneObjectState {
  body: SceneObject;
}

/** A scoped scene root that deliberately never registers window.__grafanaSceneContext. */
export class MetricSceneRoot extends SceneObjectBase<MetricSceneRootState> {
  public static readonly Component = ({ model }: Readonly<SceneComponentProps<MetricSceneRoot>>) => {
    const { body } = model.useState();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: '100%' }}>
        <body.Component model={body} />
      </div>
    );
  };
}
