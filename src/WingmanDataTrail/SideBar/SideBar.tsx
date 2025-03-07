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
import React from 'react';

import { computeMetricCategories } from 'WingmanDataTrail/MetricsVariables/computeMetricCategories';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import { VAR_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

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
  // TODO: URL sync?

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERED_METRICS_VARIABLE],
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

    // TODO: make MetricsFilterSection as Scene object that FilteredMetricsVariable can subscribe to
    // to prevent FilteredMetricsVariable to listen to the changes of state of the SideBar (inefficient)
    return (
      <div className={styles.sidebar}>
        <MetricsFilterSection
          title="Metric groups"
          items={prefixGroups}
          hideEmpty={hideEmptyGroups}
          selectedValues={selectedMetricPrefixes}
          onSelectionChange={(values) => model.setState({ selectedMetricPrefixes: values })}
          loading={loading}
        />

        <MetricsFilterSection
          title="Metric categories"
          items={categories}
          hideEmpty={hideEmptyTypes}
          selectedValues={selectedMetricCategories}
          onSelectionChange={(values) => model.setState({ selectedMetricCategories: values })}
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
      justifyContent: 'flex-start',
      gap: theme.spacing(2),
      padding: theme.spacing(1),
      width: '100%',
      height: '100%',
      overflow: 'auto',
      background: theme.colors.background.canvas,
    }),
    sectionContainer: css({
      flex: '0 0 auto',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      marginBottom: 0,
    }),
  };
}
