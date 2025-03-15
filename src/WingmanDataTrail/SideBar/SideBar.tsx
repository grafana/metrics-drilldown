import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { isEqual } from 'lodash';
import React from 'react';

import { computeMetricCategories } from 'WingmanDataTrail/MetricsVariables/computeMetricCategories';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import { VAR_METRICS_VARIABLE, type MetricsVariable } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

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
  selectedMetricPrefixes: string[];
  selectedMetricCategories: string[];
  loading: boolean;
}

export class SideBar extends SceneObjectBase<SideBarState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (variable) => {
      const { name, options } = (variable as MultiValueVariable).state;

      if (name === VAR_METRICS_VARIABLE) {
        this.updateLists(options as MetricOptions);
        return;
      }

      if (name === VAR_FILTERED_METRICS_VARIABLE) {
        this.updateCounts(options as MetricOptions);
        return;
      }
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
      selectedMetricPrefixes: [],
      selectedMetricCategories: [],
      loading: false,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const metricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable;

    this.updateLists(metricsVariable.state.options as MetricOptions);

    const filteredMetricsVariable = sceneGraph.lookupVariable(
      VAR_FILTERED_METRICS_VARIABLE,
      this
    ) as FilteredMetricsVariable;

    this.updateCounts(filteredMetricsVariable.state.options as MetricOptions);

    this._subs.add(
      filteredMetricsVariable.subscribeToState((newState, prevState) => {
        if (!prevState.loading && newState.loading) {
          this.setState({ loading: true });
        } else if (prevState.loading && !newState.loading) {
          this.setState({ loading: false });
        }
      })
    );

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (!isEqual(newState.selectedMetricPrefixes, prevState.selectedMetricPrefixes)) {
          filteredMetricsVariable.applyFilters({ prefixes: newState.selectedMetricPrefixes });
          return;
        }

        if (!isEqual(newState.selectedMetricCategories, prevState.selectedMetricCategories)) {
          filteredMetricsVariable.applyFilters({ categories: newState.selectedMetricCategories });
          return;
        }
      })
    );
  }

  private updateLists(options: MetricOptions) {
    this.setState({
      prefixGroups: computeMetricPrefixGroups(options),
      categories: computeMetricCategories(options),
    });
  }

  private updateCounts(filteredOptions: MetricOptions) {
    console.log('[TODO] SideBar.updateCounts', filteredOptions.length);
  }

  public static Component = ({ model }: SceneComponentProps<SideBar>) => {
    const styles = useStyles2(getStyles);
    const {
      hideEmptyGroups,
      hideEmptyTypes,
      selectedMetricPrefixes,
      selectedMetricCategories,
      prefixGroups,
      categories,
      loading,
    } = model.useState();

    return (
      <div className={styles.container}>
        <div className={styles.topPanel}>
          <MetricsFilterSection
            title="Metric groups"
            items={prefixGroups}
            hideEmpty={hideEmptyGroups}
            selectedValues={selectedMetricPrefixes}
            onSelectionChange={(values) => model.setState({ selectedMetricPrefixes: values })}
            loading={loading}
          />
        </div>
        <div className={styles.bottomPanel}>
          <MetricsFilterSection
            title="Metric categories"
            items={categories}
            hideEmpty={hideEmptyTypes}
            selectedValues={selectedMetricCategories}
            onSelectionChange={(values) => model.setState({ selectedMetricCategories: values })}
            loading={loading}
          />
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
    topPanel: css({
      height: '50%',
      overflow: 'hidden',
      padding: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
    bottomPanel: css({
      height: '50%',
      overflow: 'hidden',
      padding: theme.spacing(2),
      background: theme.colors.background.primary,
    }),
  };
}

export default SideBar;
