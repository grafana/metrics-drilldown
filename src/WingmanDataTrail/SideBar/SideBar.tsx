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

import { EventFiltersChanged } from 'WingmanDataTrail/HeaderControls/QuickSearch/EventFiltersChanged';
import { VAR_WINGMAN_GROUP_BY } from 'WingmanDataTrail/Labels/LabelsVariable';
import { computeMetricCategories } from 'WingmanDataTrail/MetricsVariables/computeMetricCategories';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import {
  VAR_METRICS_VARIABLE,
  type MetricOptions,
  type MetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/MetricsVariable';
import { VAR_VARIANT, type VariantVariable } from 'WingmanOnboarding/VariantVariable';

import { LabelsBrowser } from './LabelsBrowser';
import { MetricsFilterSection } from './MetricsFilterSection';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from '../MetricsVariables/FilteredMetricsVariable';

interface SideBarState extends SceneObjectState {
  prefixGroups: Array<{ label: string; value: string; count: number }>;
  categories: Array<{ label: string; value: string; count: number }>;
  hideEmptyGroups: boolean;
  hideEmptyTypes: boolean;
  selectedMetricPrefixes: string[];
  selectedMetricCategories: string[];
  loading: boolean;
  labelsBrowswer?: LabelsBrowser;
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
      loading: true,
      labelsBrowswer: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const variantVariable = sceneGraph.lookupVariable(VAR_VARIANT, this) as VariantVariable;
    if (variantVariable.state.value === 'onboard-filters-labels') {
      this.setState({
        labelsBrowswer: new LabelsBrowser({
          title: 'Breakdown by label',
          labelVariableName: VAR_WINGMAN_GROUP_BY,
        }),
      });
    }

    const metricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable;

    this.updateLists(metricsVariable.state.options as MetricOptions);

    const filteredMetricsVariable = sceneGraph.lookupVariable(
      VAR_FILTERED_METRICS_VARIABLE,
      this
    ) as FilteredMetricsVariable;

    this.updateCounts(filteredMetricsVariable.state.options as MetricOptions);

    this.setState({ loading: !filteredMetricsVariable.state.options.length });
  }

  private updateLists(options: MetricOptions) {
    this.setState({
      prefixGroups: computeMetricPrefixGroups(options),
      categories: computeMetricCategories(options),
      loading: false,
    });
  }

  private updateCounts(filteredOptions: MetricOptions) {
    const prefixGroups = computeMetricPrefixGroups(filteredOptions);
    const categories = computeMetricCategories(filteredOptions);

    this.setState({
      prefixGroups: this.state.prefixGroups.map((group) => ({
        ...group,
        count: prefixGroups.find((p) => p.label === group.label)?.count || 0,
      })),
      categories: this.state.categories.map((group) => ({
        ...group,
        count: categories.find((c) => c.label === group.label)?.count || 0,
      })),
      loading: false,
    });
  }

  public static Component = ({ model }: SceneComponentProps<SideBar>) => {
    const styles = useStyles2(getStyles);
    const { selectedMetricPrefixes, selectedMetricCategories, prefixGroups, categories, loading, labelsBrowswer } =
      model.useState();

    const onSelectFilter = (type: 'prefixes' | 'categories', filters: string[]) => {
      const selectedKey = type === 'prefixes' ? 'selectedMetricPrefixes' : 'selectedMetricCategories';
      model.setState({ [selectedKey]: filters });
      model.publishEvent(new EventFiltersChanged({ type: type, filters }));
    };

    return (
      <div className={styles.container}>
        <div className={styles.topPanel}>
          <MetricsFilterSection
            title="Metric prefix filters"
            items={prefixGroups}
            selectedValues={selectedMetricPrefixes}
            onSelectionChange={(filters) => onSelectFilter('prefixes', filters)}
            loading={loading}
          />
        </div>
        <div className={styles.bottomPanel}>
          <>
            {!labelsBrowswer && (
              <MetricsFilterSection
                title="Categories filters"
                items={categories}
                selectedValues={selectedMetricCategories}
                onSelectionChange={(filters) => onSelectFilter('categories', filters)}
                loading={loading}
              />
            )}
            {labelsBrowswer && <labelsBrowswer.Component model={labelsBrowswer} />}
          </>
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
