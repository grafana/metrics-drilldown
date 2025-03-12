import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  VariableDependencyConfig,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { IconButton, Input, Tag, useStyles2 } from '@grafana/ui';
import React, { type KeyboardEvent } from 'react';

import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { VAR_METRICS_VARIABLE, type MetricsVariable } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

interface QuickSearchState extends SceneObjectState {
  value: string;
  counts: { current: number; total: number };
}

export class QuickSearch extends SceneObjectBase<QuickSearchState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_METRICS_VARIABLE, VAR_FILTERED_METRICS_VARIABLE],
    onVariableUpdateCompleted: () => {
      const metricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable;

      this.setState({ counts: { ...this.state.counts, total: metricsVariable.state.options.length } });

      const filteredMetricsVariable = sceneGraph.lookupVariable(
        VAR_FILTERED_METRICS_VARIABLE,
        this
      ) as FilteredMetricsVariable;

      this.setState({ counts: { ...this.state.counts, current: filteredMetricsVariable.state.options.length } });
    },
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['qs'],
  });

  getUrlState() {
    return { qs: this.state.value };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const newValue = (values.qs as string) || '';

    if (newValue !== this.state.value) {
      this.setState({ value: newValue });
    }
  }

  public constructor() {
    super({
      key: 'quick-search',
      value: '',
      counts: {
        current: 0,
        total: 0,
      },
    });
  }

  private onChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.setState({ value: e.currentTarget.value });
  };

  private clear = () => {
    this.setState({ value: '' });
  };

  private onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.clear();
    }
  };

  static Component = ({ model }: { model: QuickSearch }) => {
    const styles = useStyles2(getStyles);
    const { value, counts } = model.useState();

    return (
      <Input
        value={value}
        onChange={model.onChange}
        onKeyDown={model.onKeyDown}
        placeholder="Quick search metrics..."
        prefix={<i className="fa fa-search" />}
        suffix={
          <>
            <Tag className={styles.counts} name={`${counts.current}/${counts.total}`} colorIndex={9} />
            <IconButton name="times" variant="secondary" tooltip="Clear search" onClick={model.clear} />
          </>
        }
      />
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  counts: css`
    margin-right: ${theme.spacing(1)};
    border-radius: 11px;
    padding: 2px ${theme.spacing(1)};
    color: ${theme.colors.text.primary};
    background-color: ${theme.colors.background.secondary};
  `,
});
