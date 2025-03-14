import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

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
      metricName,
      variant: variant || 'primary',
      fill: fill || 'text',
    });
  }

  public onClick = () => {};

  public static Component = ({ model }: SceneComponentProps<SelectAction>) => {
    const styles = useStyles2(getStyles);
    const { variant, fill } = model.useState();

    return (
      <Button
        variant={variant}
        fill={fill}
        size="sm"
        className={cx(styles.selectButton, styles[variant as keyof typeof styles])}
        onClick={() => {}}
      >
        Select
      </Button>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  selectButton: css``,
  secondary: css`
    color: ${theme.colors.text.secondary};
  `,
});
