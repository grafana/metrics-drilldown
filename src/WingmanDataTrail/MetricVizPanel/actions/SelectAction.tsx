import { css } from '@emotion/css';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

interface SelectActionState extends SceneObjectState {
  metricName: string;
}

export class SelectAction extends SceneObjectBase<SelectActionState> {
  constructor({ metricName }: { metricName: SelectActionState['metricName'] }) {
    super({
      metricName,
    });
  }

  public onClick = () => {};

  public static Component = ({ model }: SceneComponentProps<SelectAction>) => {
    const styles = useStyles2(getStyles);

    return (
      <Button variant="primary" fill="text" size="sm" className={styles.selectButton} onClick={() => {}}>
        Select
      </Button>
    );
  };
}

const getStyles = () => ({
  selectButton: css``,
});
