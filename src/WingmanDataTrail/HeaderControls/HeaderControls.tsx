import { type SelectableValue } from '@grafana/data';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneReactObject,
  type SceneObjectState,
  type SceneVariableSet,
} from '@grafana/scenes';

import { VAR_WINGMAN_GROUP_BY, type LabelsVariable } from 'WingmanDataTrail/Labels/LabelsVariable';

import { LayoutSwitcher } from './LayoutSwitcher';
import { MetricsSorter } from './MetricsSorter';
import { QuickSearch } from './QuickSearch';

interface HeaderControlsState extends SceneObjectState {
  $variables?: SceneVariableSet;
  inputControls?: SceneReactObject;
  onChange?: (value: SelectableValue<string>) => void; // Keeping for backward compatibility
}

export class HeaderControls extends EmbeddedScene {
  constructor(state: Partial<HeaderControlsState>) {
    super({
      ...state,
      key: 'header-controls',
      body: new SceneFlexLayout({
        direction: 'row',
        maxHeight: '32px',
        width: '100%',
        children: [
          new SceneFlexItem({
            body: new QuickSearch(),
          }),
          new SceneFlexItem({
            key: 'group-by-label-selector-wingman',
            width: 'auto',
            body: undefined,
          }),
          new SceneFlexItem({
            maxWidth: '240px',
            body: new MetricsSorter({}),
          }),
          new SceneFlexItem({
            width: 'auto',
            body: new LayoutSwitcher(),
          }),
        ],
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    const flexItem = sceneGraph.findByKey(this, 'group-by-label-selector-wingman') as SceneFlexItem;
    const labelsVariable = sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, this) as LabelsVariable;

    flexItem.setState({
      body: new SceneReactObject({
        component: labelsVariable.Component,
        props: { model: labelsVariable },
      }),
    });
  }
}
