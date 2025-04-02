import { css, cx } from '@emotion/css';
import { VariableHide, type GrafanaTheme2 } from '@grafana/data';
import { CustomVariable, sceneGraph, type MultiValueVariable, type MultiValueVariableState } from '@grafana/scenes';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';

import { MetricsOnboarding } from '../MetricsOnboarding';
export const VAR_MAIN_LABEL_VARIABLE = 'mainLabelWingman';

export class MainLabelVariable extends CustomVariable {
  public static readonly OPTIONS = ['cluster', 'job', 'namespace', 'service', 'node', 'instance'];

  constructor() {
    super({
      name: VAR_MAIN_LABEL_VARIABLE,
      query: [' ', ...MainLabelVariable.OPTIONS].join(','),
      hide: VariableHide.hideVariable,
      value: ' ',
      includeAll: false,
      allowCustomValue: true,
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
      <>
        <>
          {options
            .sort((a, b) => Number(b.label.replace(/[^0-9]/g, '')) - Number(a.label.replace(/[^0-9]/g, '')))
            .map((option) => {
              const [label, labelCardinality] = option.label.split(' ');

              const LabelCard = (
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

              if (labelCardinality.includes(`(${String(MetricsOnboarding.LABEL_VALUES_API_LIMIT)}+)`)) {
                return (
                  <Tooltip
                    key={String(option.value)}
                    content={`This label has a high cardinality, with more than ${MetricsOnboarding.LABEL_VALUES_API_LIMIT} values. For performance reasons, the application does not display the exact number.`}
                    placement="top"
                  >
                    {LabelCard}
                  </Tooltip>
                );
              }

              return LabelCard;
            })}
        </>
        <Button
          className={styles.labelButton}
          style={{ flexBasis: '100px' }}
          onClick={() => {
            window.alert(
              'Thank you for your interest in this feature to add a custom label. While it is not currently implemented, we would love to learn about your interest in it.'
            );
          }}
          tooltip="Click to add a custom label"
          tooltipPlacement="top"
        >
          + Add
        </Button>
      </>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: row;
      gap: ${theme.spacing(2)};
      width: 100%;
    `,
    labelButton: css`
      flex: 0 1 180px;
      height: 80px;
      font-size: 1.1rem;
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
