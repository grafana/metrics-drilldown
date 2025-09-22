import { css } from '@emotion/css';
import { QueryVariable, sceneGraph, type MultiValueVariable, type SceneComponentProps } from '@grafana/scenes';
import { Field, useStyles2 } from '@grafana/ui';
import React, { useCallback } from 'react';

import { reportExploreMetrics } from 'interactions';
import { ALL_VARIABLE_VALUE } from 'services/variables';
import { trailDS, VAR_FILTERS, VAR_GROUP_BY, VAR_METRIC_EXPR } from 'shared';
import { isAdHocFiltersVariable } from 'utils/utils.variables';

import { GroupBySelector, type GroupByOptions } from './GroupBySelector/GroupBySelector';

export class GroupByVariable extends QueryVariable {
  constructor() {
    super({
      name: VAR_GROUP_BY,
      label: 'Group by',
      datasource: trailDS,
      includeAll: true,
      defaultToAll: true,
      query: `label_names(${VAR_METRIC_EXPR})`,
      value: '',
      text: '',
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.filterOptions();

    this.subscribeToState((newState, prevState) => {
      if (newState.value && newState.value !== prevState.value) {
        reportExploreMetrics('groupby_label_changed', { label: String(newState.value) });
      }

      if (newState.options !== prevState.options && newState.options.find((o) => o.value === 'le')) {
        this.filterOptions(newState.options);
      }
    });

    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);

    if (isAdHocFiltersVariable(filtersVariable)) {
      filtersVariable.subscribeToState((newState, prevState) => {
        if (newState.filterExpression !== prevState.filterExpression) {
          this.changeValueTo(ALL_VARIABLE_VALUE);
        }
      });
    }
  }

  private filterOptions(options = this.state.options) {
    this.setState({ options: options.filter((o) => o.value !== 'le') });
  }

  public static readonly Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    const styles = useStyles2(getStyles);
    const { options, value, loading } = model.useState();

    const onChange = useCallback(
      (selected: string, ignore?: boolean) => {
        const next = selected === 'All' ? '$__all' : selected;
        model.changeValueTo(next, undefined, !ignore);
      },
      [model]
    );

    return (
      <Field label="By label" data-testid="breakdown-label-selector" className={styles.field}>
        <GroupBySelector
          options={options as GroupByOptions}
          value={value as string}
          onChange={onChange}
          loading={loading}
        />
      </Field>
    );
  };
}

function getStyles() {
  return {
    field: css({
      marginBottom: 0,
    }),
  };
}
