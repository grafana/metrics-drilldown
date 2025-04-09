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
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import { computeMetricSuffixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricSuffixGroups';
import {
  VAR_METRICS_VARIABLE,
  type MetricOptions,
  type MetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

import { MetricsFilterSection } from './MetricsFilterSection';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from '../MetricsVariables/FilteredMetricsVariable';

interface SideBarState extends SceneObjectState {
  prefixGroups: Array<{ label: string; value: string; count: number }>;
  suffixGroups: Array<{ label: string; value: string; count: number }>;
  hideEmptyGroups: boolean;
  hideEmptyTypes: boolean;
  selectedMetricPrefixes: string[];
  selectedMetricSuffixes: string[];
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
      suffixGroups: [],
      hideEmptyGroups: true,
      hideEmptyTypes: true,
      selectedMetricPrefixes: [],
      selectedMetricSuffixes: [],
      loading: true,
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

    this.setState({ loading: !filteredMetricsVariable.state.options.length });
  }

  private updateLists(options: MetricOptions) {
    this.setState({
      prefixGroups: computeMetricPrefixGroups(options),
      suffixGroups: computeMetricSuffixGroups(options),
      loading: false,
    });
  }

  private updateCounts(filteredOptions: MetricOptions) {
    const prefixGroups = computeMetricPrefixGroups(filteredOptions);
    const suffixGroups = computeMetricSuffixGroups(filteredOptions);

    this.setState({
      prefixGroups: this.state.prefixGroups.map((group) => ({
        ...group,
        count: prefixGroups.find((p) => p.label === group.label)?.count || 0,
      })),
      suffixGroups: this.state.suffixGroups.map((group) => ({
        ...group,
        count: suffixGroups.find((s) => s.label === group.label)?.count || 0,
      })),
      loading: false,
    });
  }

  public static Component = ({ model }: SceneComponentProps<SideBar>) => {
    const styles = useStyles2(getStyles);
    const { selectedMetricPrefixes, selectedMetricSuffixes, prefixGroups, suffixGroups, loading } = model.useState();

    const onSelectFilter = (type: 'prefixes' | 'suffixes', filters: string[]) => {
      const selectedKey = type === 'prefixes' ? 'selectedMetricPrefixes' : 'selectedMetricSuffixes';
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
            dataTestId="metric-prefix-filters"
          />
        </div>
        <div className={styles.bottomPanel}>
          <MetricsFilterSection
            title="Metric suffix filters"
            items={suffixGroups}
            selectedValues={selectedMetricSuffixes}
            onSelectionChange={(filters) => onSelectFilter('suffixes', filters)}
            loading={loading}
            dataTestId="metric-suffix-filters"
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
