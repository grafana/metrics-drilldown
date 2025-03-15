import { css, cx } from '@emotion/css';
import { VariableHide, type GrafanaTheme2 } from '@grafana/data';
import { CustomVariable, sceneGraph, type MultiValueVariable, type MultiValueVariableState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';

export const VAR_MAIN_LABEL_VARIABLE = 'mainLabelWingman';

export class MainLabelVariable extends CustomVariable {
  public static OPTIONS = ['cluster', 'job', 'namespace', 'service', 'node', 'instance'];

  constructor() {
    super({
      name: VAR_MAIN_LABEL_VARIABLE,
      query: MainLabelVariable.OPTIONS.join(','),
      hide: VariableHide.hideVariable,
      value: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const filteredMetricsVariable = sceneGraph.lookupVariable(
      VAR_FILTERED_METRICS_VARIABLE,
      this
    ) as FilteredMetricsVariable;

    // TODO: publish event instead?
    filteredMetricsVariable.updateGroupByQuery(this.state.value as string);

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          filteredMetricsVariable.updateGroupByQuery(this.state.value as string);
        }
      })
    );
  }

  static Component = ({ model }: { model: MultiValueVariable<MultiValueVariableState> }) => {
    const styles = useStyles2(getStyles);
    const { options, value } = model.useState();

    const toggle = (newValue: any) => () => {
      model.changeValueTo(newValue === value ? '' : newValue);
    };

    return (
      <div className={styles.container}>
        {options
          .sort((a, b) => Number(b.label.replace(/[^0-9]/g, '')) - Number(a.label.replace(/[^0-9]/g, '')))
          .map((option) => {
            const [label, labelCardinality] = option.label.split(' ');

            return (
              <Button
                key={String(option.value)}
                className={cx(styles.labelButton, { [styles.selected]: option.value === value })}
                onClick={toggle(option.value)}
                title={`Group metrics by ${label}`}
                disabled={labelCardinality === '(0)'}
              >
                {label} {labelCardinality}
              </Button>
            );
          })}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: row;
      gap: ${theme.spacing(2)};
    `,
    labelButton: css`
      width: 200px;
      height: 80px;
      font-size: 16px;
      margin: 0;
      text-align: center;
      justify-content: center;

      box-sizing: border-box;
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: 8px;
      padding: ${theme.spacing(2)};
      transition: all 0.1s ease-in-out;

      &:hover {
        background-color: ${theme.colors.background.secondary};
        border-color: ${theme.colors.border.medium};
      }

      & span {
        display: inline-block;
        height: unset;
      }
    `,
    selected: css`
      border: 2px solid ${theme.colors.primary.main};
      background-color: ${theme.colors.background.primary};

      &:hover {
        background-color: ${theme.colors.background.primary};
        border-color: ${theme.colors.primary.main};
      }
    `,
  };
}
