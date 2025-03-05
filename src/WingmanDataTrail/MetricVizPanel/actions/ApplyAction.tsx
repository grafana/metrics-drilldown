import { css } from '@emotion/css';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

interface ApplyActionState extends SceneObjectState {
  metricName: string;
  disabled: boolean;
}

export class ApplyAction extends SceneObjectBase<ApplyActionState> {
  constructor({
    metricName,
    disabled,
  }: {
    metricName: ApplyActionState['metricName'];
    disabled?: ApplyActionState['disabled'];
  }) {
    super({
      metricName,
      disabled: Boolean(disabled),
    });
  }

  public onClick = () => {};

  public static Component = ({ model }: SceneComponentProps<ApplyAction>) => {
    const styles = useStyles2(getStyles);
    const { disabled } = model.useState();
    return (
      <Button
        variant="primary"
        fill="text"
        size="sm"
        className={styles.selectButton}
        onClick={() => {}}
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
