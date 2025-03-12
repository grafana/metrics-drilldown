import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { SceneDrawer } from 'WingmanDataTrail/SceneDrawer';

import { MetricsTreeFilter } from './MetricsTreeFilter';

interface MetricsTreeFilterToggleState extends SceneObjectState {
  drawer: SceneDrawer;
}

export class MetricsTreeFilterToggle extends SceneObjectBase<MetricsTreeFilterToggleState> {
  constructor(state: Partial<MetricsTreeFilterToggleState>) {
    super({
      ...state,
      key: 'MetricsTreeFilterToggle',
      drawer: new SceneDrawer({}),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {}

  private openDrawer() {
    this.state.drawer.open({
      title: 'Filter metrics by name (UX only - not functional)',
      subTitle: 'Select the parts of the metric name you want to filter by',
      body: new MetricsTreeFilter({}),
    });
  }

  private onClickFilter = () => {
    this.openDrawer();
  };

  public static Component = ({ model }: SceneComponentProps<MetricsTreeFilterToggle>) => {
    const styles = useStyles2(getStyles);
    const { drawer } = model.useState();

    return (
      <div className={styles.container}>
        <Button icon="filter" onClick={model.onClickFilter}>
          Filter metrics
        </Button>
        <drawer.Component model={drawer} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
    `,
  };
}
