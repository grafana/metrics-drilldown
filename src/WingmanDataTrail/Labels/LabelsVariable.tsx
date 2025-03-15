import { css } from '@emotion/css';
import { VariableHide, VariableRefresh, type GrafanaTheme2 } from '@grafana/data';
import { QueryVariable, sceneGraph, type MultiValueVariable, type SceneComponentProps } from '@grafana/scenes';
import { Label, useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_FILTERS_EXPR } from 'shared';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';

import { LabelsDataSource, NULL_GROUP_BY_VALUE } from './LabelsDataSource';

export const VAR_WINGMAN_GROUP_BY = 'labelsWingman';

export class LabelsVariable extends QueryVariable {
  constructor() {
    super({
      name: VAR_WINGMAN_GROUP_BY,
      label: 'Group by label',
      placeholder: 'Group by label...',
      datasource: { uid: LabelsDataSource.uid },
      query: '',
      includeAll: false,
      isMulti: false,
      allowCustomValue: false,
      refresh: VariableRefresh.onTimeRangeChanged,
      hide: VariableHide.hideVariable,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
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

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.query !== prevState.query) {
          // preserve the value form URL search params when landing
          if (prevState.query) {
            this.setState({ value: NULL_GROUP_BY_VALUE });
          }

          this.refreshOptions();
        }
      })
    );

    const filterExpression = sceneGraph.interpolate(this, VAR_FILTERS_EXPR, {});

    // hack to ensure that labels are loaded when landing: sometimes filters are not interpolated and fetching labels give no results
    this.setState({ query: `{__name__=~".+",${filterExpression}}` });
  }

  static Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    const styles = useStyles2(getStyles);
    const { label } = model.useState();

    return (
      <div className={styles.container}>
        <Label className={styles.label}>{label}</Label>
        <QueryVariable.Component model={model} />
      </div>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    align-items: center;
    gap: 0;

    [class*='input-wrapper'] {
      width: 240px;
    }
  `,
  label: css`
    height: 32px;
    white-space: nowrap;
    margin: 0;
    background-color: ${theme.colors.background.primary};
    padding: ${theme.spacing(1)};
    border-radius: ${theme.shape.radius.default};
    border: 1px solid ${theme.colors.border.weak};
    border-right: none;
  `,
});
