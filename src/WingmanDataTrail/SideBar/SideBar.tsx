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

import { MetricsFilterSection } from './MetricsFilterSection';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from '../MetricsVariables/FilteredMetricsVariable';

type Options = Array<{ label: string; value: string }>;

interface SideBarState extends SceneObjectState {
  prefixGroups: Array<{ label: string; value: string; count: number }>;
  hideEmptyGroups: boolean;
  hideEmptyTypes: boolean;
  selectedMetricGroups: string[];
  selectedMetricTypes: string[];
  metricsGroupSearch: string;
  metricsTypeSearch: string;
}

const baseMetricTypes = [
  { label: 'request', value: 'request', count: 12 },
  { label: 'response', value: 'response', count: 0 },
  { label: 'duration', value: 'duration', count: 7 },
  { label: 'total', value: 'total', count: 0 },
  { label: 'latency', value: 'latency', count: 8 },
  { label: 'errors', value: 'errors', count: 5 },
  { label: 'bytes', value: 'bytes', count: 0 },
  { label: 'connections', value: 'connections', count: 6 },
  { label: 'memory', value: 'memory', count: 4 },
  { label: 'cpu', value: 'cpu', count: 9 },
  { label: 'disk', value: 'disk', count: 5 },
  { label: 'network', value: 'network', count: 7 },
];

export class SideBar extends SceneObjectBase<SideBarState> {
  private static GROUP_CATCH_ALL = '*';

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
      hideEmptyGroups: true,
      hideEmptyTypes: true,
      selectedMetricGroups: [],
      selectedMetricTypes: [],
      metricsGroupSearch: '',
      metricsTypeSearch: '',
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {}

  private updateCounts() {
    const metricsVariable = sceneGraph.lookupVariable(VAR_FILTERED_METRICS_VARIABLE, this) as FilteredMetricsVariable;

    const options = metricsVariable.state.options as Options;

    this.setState({ prefixGroups: this.computePrefixGroups(options) });
  }

  private computePrefixGroups(options: Options) {
    const rawPrefixesMap = new Map();

    for (const option of options) {
      const [sep] = option.value.match(/[^a-z0-9]/i) || [];

      if (!sep) {
        rawPrefixesMap.set(SideBar.GROUP_CATCH_ALL, (rawPrefixesMap.get(SideBar.GROUP_CATCH_ALL) ?? 0) + 1);
      } else {
        const [prefix] = option.value.split(sep);
        rawPrefixesMap.set(prefix, (rawPrefixesMap.get(prefix) ?? 0) + 1);
      }
    }

    const prefixesMap = new Map([[SideBar.GROUP_CATCH_ALL, 0]]);

    for (const [prefix, count] of rawPrefixesMap) {
      if (count === 1) {
        prefixesMap.set(SideBar.GROUP_CATCH_ALL, (prefixesMap.get(SideBar.GROUP_CATCH_ALL) ?? 0) + 1);
      } else {
        prefixesMap.set(prefix, count);
      }
    }

    return Array.from(prefixesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        value: label,
        count,
      }));
  }

  public static Component = ({ model }: SceneComponentProps<SideBar>) => {
    const styles = useStyles2(getStyles);
    const {
      hideEmptyGroups,
      hideEmptyTypes,
      selectedMetricGroups,
      selectedMetricTypes,
      metricsGroupSearch,
      metricsTypeSearch,
      prefixGroups,
    } = model.useState();

    return (
      <div className={styles.sidebar}>
        <MetricsFilterSection
          title="Metrics group"
          items={prefixGroups}
          hideEmpty={hideEmptyGroups}
          searchValue={metricsGroupSearch}
          selectedValues={selectedMetricGroups}
          onSearchChange={(value) => model.setState({ metricsGroupSearch: value })}
          onSelectionChange={(values) => model.setState({ selectedMetricGroups: values })}
        />

        <MetricsFilterSection
          title="Metrics types"
          items={baseMetricTypes}
          hideEmpty={hideEmptyTypes}
          searchValue={metricsTypeSearch}
          selectedValues={selectedMetricTypes}
          onSearchChange={(value) => model.setState({ metricsTypeSearch: value })}
          onSelectionChange={(values) => model.setState({ selectedMetricTypes: values })}
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
