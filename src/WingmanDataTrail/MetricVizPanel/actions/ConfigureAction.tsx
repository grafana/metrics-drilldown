import { css } from '@emotion/css';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { EventConfigureFunction } from './EventConfigureFunction';

interface ConfigureActionState extends SceneObjectState {
  metricName: string;
}

export class ConfigureAction extends SceneObjectBase<ConfigureActionState> {
  static PROMETHEUS_FN_OPTIONS = [
    { label: 'Average', value: 'avg' },
    { label: 'Sum', value: 'sum' },
    { label: 'Minimum', value: 'min' },
    { label: 'Maximum', value: 'max' },
    { label: 'Rate', value: 'rate' },
  ] as const;

  constructor({ metricName }: { metricName: ConfigureActionState['metricName'] }) {
    super({
      key: `configure-action-${metricName}`,
      metricName,
    });
  }

  public onClick = () => {
    this.publishEvent(new EventConfigureFunction({ metricName: this.state.metricName }), true);
  };

  public static Component = ({ model }: SceneComponentProps<ConfigureAction>) => {
    const styles = useStyles2(getStyles);

    return (
      <Button
        className={styles.selectButton}
        aria-label="Configure"
        variant="secondary"
        size="sm"
        fill="text"
        onClick={model.onClick}
        icon="cog"
        tooltip="Configure the Prometheus function"
        tooltipPlacement="top"
      />
    );
  };
}

const getStyles = () => ({
  selectButton: css`
    margin: 0;
    padding: 0;
  `,
});

export type PrometheusFn = (typeof ConfigureAction.PROMETHEUS_FN_OPTIONS)[number]['value'];
