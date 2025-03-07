import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { computeMetricCategories } from 'WingmanDataTrail/MetricsVariables/computeMetricCategories';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';

import { MetricsFilterSection } from './MetricsFilterSection';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
  type MetricOptions,
} from '../MetricsVariables/FilteredMetricsVariable';

interface SideBarState extends SceneObjectState {
  prefixGroups: Array<{ label: string; value: string; count: number }>;
  categories: Array<{ label: string; value: string; count: number }>;
  hideEmptyGroups: boolean;
  hideEmptyTypes: boolean;
  selectedMetricGroups: string[];
  selectedMetricTypes: string[];
  loading: boolean;
}

export class SideBar extends SceneObjectBase<SideBarState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERED_METRICS_VARIABLE],
    onVariableUpdateCompleted: () => {
      this.updateCounts();
    },
  });

  constructor(state: Partial<SideBarState>) {
    super({
      ...state,
      key: 'sidebar',
      prefixGroups: [],
      categories: [],
      hideEmptyGroups: true,
      hideEmptyTypes: true,
      selectedMetricGroups: [],
      selectedMetricTypes: [],
      loading: true,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const filteredMetricsVariable = sceneGraph.lookupVariable(
      VAR_FILTERED_METRICS_VARIABLE,
      this
    ) as FilteredMetricsVariable;

    this._subs.add(
      filteredMetricsVariable.subscribeToState((newState, prevState) => {
        if (!prevState.loading && newState.loading) {
          this.setState({ loading: true });
        } else if (prevState.loading && !newState.loading) {
          this.setState({ loading: false });
        }
      })
    );
  }

  private updateCounts() {
    const metricsVariable = sceneGraph.lookupVariable(VAR_FILTERED_METRICS_VARIABLE, this) as FilteredMetricsVariable;
    const options = metricsVariable.state.options as MetricOptions;

    this.setState({
      prefixGroups: computeMetricPrefixGroups(options),
      categories: computeMetricCategories(options),
    });
  }

  public static Component = ({ model }: SceneComponentProps<SideBar>) => {
    const styles = useStyles2(getStyles);
    const {
      hideEmptyGroups,
      hideEmptyTypes,
      selectedMetricGroups,
      selectedMetricTypes,
      prefixGroups,
      categories,
      loading,
    } = model.useState();

    return (
      <div className={styles.sidebar}>
        <MetricsFilterSection
          title="Metric groups"
          items={prefixGroups}
          hideEmpty={hideEmptyGroups}
          selectedValues={selectedMetricGroups}
          onSelectionChange={(values) => model.setState({ selectedMetricGroups: values })}
          loading={loading}
        />

        <MetricsFilterSection
          title="Metric categories"
          items={categories}
          hideEmpty={hideEmptyTypes}
          selectedValues={selectedMetricTypes}
          onSelectionChange={(values) => model.setState({ selectedMetricTypes: values })}
          loading={loading}
        />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebar: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(1),
      width: '250px',
      height: '100%',
      overflow: 'hidden',
      borderRadius: theme.shape.radius.default,
      borderRight: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
