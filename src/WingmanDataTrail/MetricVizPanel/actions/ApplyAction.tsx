import { css } from '@emotion/css';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type PrometheusFn } from './ConfigureAction';
import { EventApplyFunction } from './EventApplyFunction';

interface ApplyActionState extends SceneObjectState {
  metricName: string;
  prometheusFunction: PrometheusFn;
  disabled?: boolean;
}

export class ApplyAction extends SceneObjectBase<ApplyActionState> {
  constructor({ metricName, prometheusFunction, disabled }: ApplyActionState) {
    super({
      key: `apply-action-${metricName}`,
      metricName,
      prometheusFunction,
      disabled: Boolean(disabled),
    });
  }

  public onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const { metricName, prometheusFunction } = this.state;

    event.preventDefault();

    this.publishEvent(
      new EventApplyFunction({
        metricName,
        prometheusFunction,
      }),
      true
    );
  };

  public static Component = ({ model }: SceneComponentProps<ApplyAction>) => {
    const styles = useStyles2(getStyles);
    const { disabled } = model.useState();

    return (
      <Button
        variant="primary"
        fill="outline"
        size="sm"
        className={styles.selectButton}
        onClick={model.onClick}
        disabled={disabled}
      >
        Apply
      </Button>
    );
  };
}

const getStyles = () => ({
  selectButton: css``,
});
