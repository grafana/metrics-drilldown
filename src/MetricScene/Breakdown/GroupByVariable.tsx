import { css } from '@emotion/css';
import { BusEventWithPayload } from '@grafana/data';
import { t } from '@grafana/i18n';
import { QueryVariable, sceneGraph, type MultiValueVariable, type SceneComponentProps } from '@grafana/scenes';
import { Field, useStyles2 } from '@grafana/ui';
import React, { useCallback } from 'react';

import { trailDS, VAR_FILTERS, VAR_GROUP_BY, VAR_METRIC_EXPR } from 'shared/shared';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { isAdHocFiltersVariable } from 'shared/utils/utils.variables';

import { GroupBySelector, type GroupByOptions } from './GroupBySelector/GroupBySelector';

const ALL_VARIABLE_VALUE = '$__all';

/**
 * Event emitted when GroupByVariable options are loaded or updated.
 * This allows external behaviors to react to option changes.
 */
export class GroupByOptionsLoadedEvent extends BusEventWithPayload<GroupByVariable> {
  public static readonly type = 'groupby-options-loaded';
}

export class GroupByVariable extends QueryVariable {
  constructor() {
    super({
      name: VAR_GROUP_BY,
      label: t('breakdown.group-by.label', 'Group by'),
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

    // Emit event on activation if options are already loaded (handles edge case where variable 
    // is reactivated with cached options or activates after behavior subscribes)
    if (this.state.options.length > 0) {
      this.publishEvent(new GroupByOptionsLoadedEvent(this), true);
    }

    this.subscribeToState((newState, prevState) => {
      if (newState.value && newState.value !== prevState.value) {
        reportExploreMetrics('groupby_label_changed', { label: String(newState.value) });
      }

      if (newState.options !== prevState.options && newState.options.find((o) => o.value === 'le')) {
        this.filterOptions(newState.options);
      }
      
      // Emit event when options are loaded or updated
      if (newState.options !== prevState.options && newState.options.length > 0) {
        this.publishEvent(new GroupByOptionsLoadedEvent(this), true);
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
      <Field label={t('breakdown.by-label', 'By label')} data-testid="breakdown-label-selector" className={styles.field}>
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
