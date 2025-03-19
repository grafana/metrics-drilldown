import { css } from '@emotion/css';
import { type SelectableValue } from '@grafana/data';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneReactObject,
  type SceneVariableSet,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_VARIANT, type VariantVariable } from 'WingmanOnboarding/VariantVariable';

import { LayoutSwitcher } from './LayoutSwitcher';
import { ROUTES } from '../../constants';
import { MetricsFilter } from './MetricsFilter/MetricsFilter';
import { MetricsSorter } from './MetricsSorter';
import { QuickSearch } from './QuickSearch/QuickSearch';

interface HeaderControlsState extends SceneObjectState {
  $variables?: SceneVariableSet;
  inputControls?: SceneReactObject;
  onChange?: (value: SelectableValue<string>) => void; // Keeping for backward compatibility
}

// @ts-ignore to fix build error. Is there a Scenes friend way of doing this?
export class HeaderControls extends EmbeddedScene {
  constructor(state: Partial<HeaderControlsState>) {
    super({
      ...state,
      key: 'header-controls',
      body: new SceneFlexLayout({
        direction: 'row',
        width: '100%',
        maxHeight: '32px',
        children: [
          new SceneFlexItem({
            body: new QuickSearch(),
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
    const variant = (sceneGraph.lookupVariable(VAR_VARIANT, this) as VariantVariable).state.value as string;

    // see comment in MetricsReducer
    if ([ROUTES.TrialWithPills, ROUTES.OnboardWithPills].includes(variant as string)) {
      (this.state.body as SceneFlexLayout).setState({
        children: [
          new SceneFlexItem({
            width: 'auto',
            body: new MetricsFilter({ type: 'prefixes' }),
          }),
          new SceneFlexItem({
            width: 'auto',
            body: new MetricsFilter({ type: 'categories' }),
          }),
          ...(this.state.body as SceneFlexLayout).state.children,
        ],
      });
    }
  }

  public static Component = ({ model }: SceneComponentProps<HeaderControls>) => {
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
