import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  CustomVariable,
  sceneGraph,
  SceneObjectBase,
  SceneVariableSet,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsGroupByList } from './GroupBy/MetricsGroupByList';
import { groupByOptions, VAR_GROUP_BY } from './HeaderControls/GroupByControls';
import { HeaderControls } from './HeaderControls/HeaderControls';
import { SimpleMetricsList } from './MetricsList/SimpleMetricsList';
import { MetricsFilterSection } from './SideBar/MetricsFilterSection';

interface MetricsReducerState extends SceneObjectState {
  headerControls: HeaderControls;
  body: MetricsGroupByList | SimpleMetricsList;
  groupBy: string;
  hideEmptyGroups: boolean;
  hideEmptyTypes: boolean;
  selectedMetricGroups: string[];
  selectedMetricTypes: string[];
  metricsGroupSearch: string;
  metricsTypeSearch: string;
}

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  public constructor() {
    super({
      headerControls: new HeaderControls({}),
      groupBy: 'cluster',
      hideEmptyGroups: true,
      hideEmptyTypes: true,
      selectedMetricGroups: [],
      selectedMetricTypes: [],
      metricsGroupSearch: '',
      metricsTypeSearch: '',
      body: new SimpleMetricsList(),
      $variables: new SceneVariableSet({
        variables: [
          new CustomVariable({
            name: VAR_GROUP_BY,
            label: 'Group By',
            value: 'cluster', // Default value
            query: groupByOptions.map((option) => `${option.label} : ${option.value}`).join(','),
          }),
        ],
      }),
    });

    // Add activation handler to listen for groupBy variable changes
    this.addActivationHandler(() => this.activationHandler());
  }

  private activationHandler() {
    const variables = sceneGraph.getVariables(this);
    const groupByVar = variables.getByName(VAR_GROUP_BY);

    if (groupByVar) {
      // Set initial state based on the current value
      const currentValue = groupByVar.getValue() as string;
      this.updateBodyBasedOnGroupBy(currentValue);

      // Subscribe to VAR_GROUP_BY changes
      this._subs.add(
        groupByVar.subscribeToState((state: any) => {
          const value = state.value || state.getValue?.();
          if (value) {
            this.updateBodyBasedOnGroupBy(value as string);
          }
        })
      );
    }
  }

  private updateBodyBasedOnGroupBy(groupByValue: string) {
    this.setState({
      groupBy: groupByValue,
      body: !groupByValue || groupByValue === 'none' ? new SimpleMetricsList() : new MetricsGroupByList({}),
    });
  }

  private MetricsSidebar = () => {
    const {
      hideEmptyGroups,
      hideEmptyTypes,
      selectedMetricGroups,
      selectedMetricTypes,
      metricsGroupSearch,
      metricsTypeSearch,
    } = this.useState();
    const styles = useStyles2(getStyles);

    const baseMetricGroups = [
      { label: 'alloy', value: 'alloy', count: 57 },
      { label: 'apollo', value: 'apollo', count: 0 },
      { label: 'grafana', value: 'grafana', count: 33 },
      { label: 'prometheus', value: 'prometheus', count: 45 },
      { label: 'loki', value: 'loki', count: 0 },
      { label: 'tempo', value: 'tempo', count: 19 },
      { label: 'mimir', value: 'mimir', count: 23 },
      { label: 'cortex', value: 'cortex', count: 0 },
      { label: 'thanos', value: 'thanos', count: 41 },
      { label: 'jaeger', value: 'jaeger', count: 25 },
      { label: 'k8s', value: 'k8s', count: 63 },
      { label: 'elasticsearch', value: 'elasticsearch', count: 38 },
      { label: 'redis', value: 'redis', count: 29 },
      { label: 'postgres', value: 'postgres', count: 52 },
      { label: 'mongodb', value: 'mongodb', count: 31 },
      { label: 'kafka', value: 'kafka', count: 47 },
    ];

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

    return (
      <div className={styles.sidebar}>
        <MetricsFilterSection
          title="Metrics group"
          items={baseMetricGroups}
          hideEmpty={hideEmptyGroups}
          searchValue={metricsGroupSearch}
          selectedValues={selectedMetricGroups}
          onSearchChange={(value) => this.setState({ metricsGroupSearch: value })}
          onSelectionChange={(values) => this.setState({ selectedMetricGroups: values })}
        />

        <MetricsFilterSection
          title="Metrics types"
          items={baseMetricTypes}
          hideEmpty={hideEmptyTypes}
          searchValue={metricsTypeSearch}
          selectedValues={selectedMetricTypes}
          onSearchChange={(value) => this.setState({ metricsTypeSearch: value })}
          onSelectionChange={(values) => this.setState({ selectedMetricTypes: values })}
        />
      </div>
    );
  };

  public static Component = ({ model }: SceneComponentProps<MetricsReducer>) => {
    const styles = useStyles2(getStyles);
    const { body, headerControls } = model.useState();

    return (
      <div className={styles.container}>
        <div className={styles.headerControls}>
          <headerControls.Component model={headerControls} />
        </div>
        <div className={styles.content}>
          <model.MetricsSidebar />

          <div className={styles.mainContent}>
            <body.Component model={body as any} />
          </div>
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
      gap: theme.spacing(1),
    }),
    headerControls: css({}),
    content: css({
      display: 'flex',
      flexGrow: 1,
      gap: theme.spacing(2),
      height: '100%',
      overflow: 'hidden',
    }),
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
    mainContent: css({
      flexGrow: 1,
      overflow: 'auto',
      padding: theme.spacing(1),
    }),
  };
}
