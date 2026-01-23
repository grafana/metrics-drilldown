import { css } from '@emotion/css';
import { VariableHide, VariableRefresh, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AdHocFiltersVariable,
  DataSourceVariable,
  QueryVariable,
  sceneGraph,
  type MultiValueVariable,
  type SceneComponentProps,
} from '@grafana/scenes';
import { Label, useStyles2 } from '@grafana/ui';
import React from 'react';

import { localeCompare } from 'MetricsReducer/helpers/localCompare';
import { VAR_DATASOURCE, VAR_FILTERS, VAR_FILTERS_EXPR } from 'shared/shared';

import { LabelsDataSource, NULL_GROUP_BY_VALUE } from './LabelsDataSource';

export const VAR_WINGMAN_GROUP_BY = 'labelsWingman';

export class LabelsVariable extends QueryVariable {
  constructor() {
    super({
      key: VAR_WINGMAN_GROUP_BY,
      name: VAR_WINGMAN_GROUP_BY,
      label: t('labels-variable.label', 'Group by label'),
      placeholder: t('labels-variable.placeholder', 'Group by label...'),
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
    this.subscribeToState((newState, prevState) => {
      if (newState.query !== prevState.query) {
        // store the current value in a static option so we can preserve it in the UI even if new options don't contain it
        this.setState({
          staticOptions: [{ value: newState.value as string, label: newState.value as string }],
        });

        this.refreshOptions();
      }

      if (newState.options !== prevState.options) {
        const { value } = this.state;

        if (newState.options.some((o) => o.value === value)) {
          this.setState({
            staticOptions: [],
            // eslint-disable-next-line sonarjs/no-misleading-array-reverse
            options: newState.options.sort((a, b) => localeCompare(a.label, b.label)),
          });
        }
      }
    });

    this._subs.add(
      sceneGraph.findByKeyAndType(this, VAR_DATASOURCE, DataSourceVariable).subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.setState({ value: NULL_GROUP_BY_VALUE });
          this.refreshOptions();
        }
      })
    );

    this._subs.add(
      sceneGraph.findByKeyAndType(this, VAR_FILTERS, AdHocFiltersVariable).subscribeToState((newState, prevState) => {
        if (newState.filterExpression !== prevState.filterExpression) {
          this.updateQuery();
        }
      })
    );

    // hack to ensure that labels are loaded when landing: sometimes filters are not interpolated and fetching labels give no results
    this.updateQuery();
  }

  private updateQuery() {
    const filterExpression = sceneGraph.interpolate(this, VAR_FILTERS_EXPR, {});
    this.setState({ query: `{__name__=~".+",${filterExpression}}` });
  }

  static readonly Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
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
