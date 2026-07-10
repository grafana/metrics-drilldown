import { SceneObjectBase, type SceneDataLayerSet, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';

export interface KgAnnotationToggleState extends SceneObjectState {
  isEnabled: boolean;
  layerSetRef: SceneObjectRef<SceneDataLayerSet>;
}

export class KgAnnotationToggle extends SceneObjectBase<KgAnnotationToggleState> {
  static readonly Component = () => null;

  public toggleEnabled = () => {
    const next = !this.state.isEnabled;
    this.setState({ isEnabled: next });
    for (const layer of this.state.layerSetRef.resolve().state.layers) {
      layer.setState({ isEnabled: next });
    }
  };

  public syncLayerEnabledState = () => {
    for (const layer of this.state.layerSetRef.resolve().state.layers) {
      layer.setState({ isEnabled: this.state.isEnabled });
    }
  };
}
