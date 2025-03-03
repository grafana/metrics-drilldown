import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

interface MetricsReducerState extends SceneObjectState {}

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  constructor(props: {}) {
    super(props);
  }
}

export const metricsReducer = new MetricsReducer({});
