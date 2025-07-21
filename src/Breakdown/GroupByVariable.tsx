import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { QueryVariable, sceneGraph, type MultiValueVariable, type SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from 'interactions';
import { ALL_VARIABLE_VALUE } from 'services/variables';
import { trailDS, VAR_FILTERS, VAR_GROUP_BY, VAR_METRIC_EXPR } from 'shared';
import { isAdHocFiltersVariable } from 'utils/utils.variables';

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
    this.subscribeToState((newState, prevState) => {
      if (newState.value && newState.value !== prevState.value) {
        reportExploreMetrics('groupby_label_changed', { label: String(newState.value) });
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

  public static readonly Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.select} data-testid="breakdown-label-selector">
        <QueryVariable.Component model={model} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    select: css`
      width: ${theme.spacing(16)};
      & > div {
        width: 100%;
      }
    `,
  };
}
