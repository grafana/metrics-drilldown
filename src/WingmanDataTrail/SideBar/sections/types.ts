import { type IconName } from '@grafana/data';
import { type SceneComponent, type SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

export interface SideBarSectionState extends SceneObjectState {
  key: string;
  title: string;
  description: string;
  icon: IconName | string;
  disabled: boolean;
  active: boolean;
}

export interface SideBarSection extends SceneObjectBase<SideBarSectionState> {
  Component: SceneComponent<SideBarSection>;
}
