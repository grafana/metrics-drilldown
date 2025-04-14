import { css } from '@emotion/css';
import { type SelectableValue } from '@grafana/data';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneReactObject,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneVariableSet,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_WINGMAN_GROUP_BY, type LabelsVariable } from 'WingmanDataTrail/Labels/LabelsVariable';

import { LayoutSwitcher } from './LayoutSwitcher';
import { MetricsSorter } from './MetricsSorter/MetricsSorter';
import { QuickSearch } from './QuickSearch/QuickSearch';

interface ListControlsState extends SceneObjectState {
  $variables?: SceneVariableSet;
  inputControls?: SceneReactObject;
  onChange?: (value: SelectableValue<string>) => void; // Keeping for backward compatibility
}

// @ts-ignore to fix build error. Is there a Scenes friend way of doing this?
export class ListControls extends EmbeddedScene {
  constructor(state: Partial<ListControlsState>) {
    super({
      ...state,
      key: 'list-controls',
      body: new SceneFlexLayout({
        direction: 'row',
        width: '100%',
        maxHeight: '32px',
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
    const labelsVariable = sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, this) as LabelsVariable;

    (
      (this.state.body as SceneFlexLayout).state.children.find(
        (c) => c.state.key === 'group-by-label-selector-wingman'
      ) as SceneFlexItem
    )?.setState({
      body: new SceneReactObject({
        component: labelsVariable.Component,
        props: { model: labelsVariable },
      }),
    });
  }

  public static Component = ({ model }: SceneComponentProps<ListControls>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();

    return (
      <div className={styles.headerWrapper}>
        <body.Component model={body} />
      </div>
    );
  };
}

function getStyles() {
  return {
    headerWrapper: css({
      display: 'flex',
      alignItems: 'center',
      '& > div': {
        display: 'flex',
        alignItems: 'center',
        '& > div': {
          display: 'flex',
          alignItems: 'center',
        },
      },
    }),
  };
}
