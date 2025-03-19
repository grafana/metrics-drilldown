import { css } from '@emotion/css';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricSelectedEvent } from 'shared';

interface SelectActionState extends SceneObjectState {
  metricName: string;
  variant: 'primary' | 'secondary';
  fill: 'solid' | 'outline' | 'text';
}

export class SelectAction extends SceneObjectBase<SelectActionState> {
  constructor({
    metricName,
    variant,
    fill,
  }: {
    metricName: SelectActionState['metricName'];
    variant?: SelectActionState['variant'];
    fill?: SelectActionState['fill'];
  }) {
    super({
      key: `select-action-${metricName}`,
      metricName,
      variant: variant || 'primary',
      fill: fill || 'text',
    });
  }

  public onClick = () => {
    this.publishEvent(new MetricSelectedEvent(this.state.metricName), true);
  };

  public static Component = ({ model }: SceneComponentProps<SelectAction>) => {
    const styles = useStyles2(getStyles);
    const { variant, fill } = model.useState();

    return (
      <Button variant={variant} fill={fill} size="sm" className={styles.selectButton} onClick={model.onClick}>
        Select
      </Button>
    );
  };
}

const getStyles = () => ({
  selectButton: css``,
});
