import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { SceneObjectBase, type SceneComponentProps, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import { Drawer, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type DataTrail } from '../DataTrail';
import { getTrailFor } from '../utils';
import { ShowModalReactEvent } from '../utils/utils.events';
import { getAppBackgroundColor } from '../utils/utils.styles';

export type SceneDrawerProps = {
  scene: SceneObject;
  title: string;
  onDismiss: () => void;
};

export function SceneDrawer(props: Readonly<SceneDrawerProps>) {
  const { scene, title, onDismiss } = props;
  const trail = getTrailFor(scene);
  const styles = useStyles2(getStyles, trail);

  return (
    <Drawer title={title} onClose={onDismiss} size="lg">
      <div className={styles.drawerInnerWrapper}>
        <scene.Component model={scene} />
      </div>
    </Drawer>
  );
}

interface SceneDrawerAsSceneState extends SceneObjectState, SceneDrawerProps {}

export class SceneDrawerAsScene extends SceneObjectBase<SceneDrawerAsSceneState> {
  constructor(state: SceneDrawerProps) {
    super(state);
  }

  static Component({ model }: SceneComponentProps<SceneDrawerAsScene>) {
    const state = model.useState();

    return <SceneDrawer {...state} />;
  }
}

export function launchSceneDrawerInGlobalModal(props: Omit<SceneDrawerProps, 'onDismiss'>) {
  const payload = {
    component: SceneDrawer,
    props,
  };

  getAppEvents().publish(new ShowModalReactEvent(payload));
}

function getStyles(theme: GrafanaTheme2, trail: DataTrail) {
  return {
    drawerInnerWrapper: css({
      display: 'flex',
      padding: theme.spacing(2),
      background: getAppBackgroundColor(theme, trail),
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
    }),
  };
}
