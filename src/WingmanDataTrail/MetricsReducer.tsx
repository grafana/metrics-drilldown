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

import { groupByOptions, VAR_GROUP_BY } from './HeaderControls/GroupByControls';
import { HeaderControls } from './HeaderControls/HeaderControls';
import { MetricsGroupByList } from './MetricsGroupByList';
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
      body:
        !groupByValue || groupByValue === 'none'
          ? new SimpleMetricsList()
          : new MetricsGroupByList({ groupBy: groupByValue }),
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
      { label: 'alloy (57)', value: 'alloy' },
      { label: 'apollo (0)', value: 'apollo' },
      { label: 'grafana (33)', value: 'grafana' },
      { label: 'prometheus (45)', value: 'prometheus' },
      { label: 'loki (0)', value: 'loki' },
      { label: 'tempo (19)', value: 'tempo' },
      { label: 'mimir (23)', value: 'mimir' },
      { label: 'cortex (0)', value: 'cortex' },
      { label: 'thanos (41)', value: 'thanos' },
      { label: 'jaeger (25)', value: 'jaeger' },
      { label: 'k8s (63)', value: 'k8s' },
      { label: 'elasticsearch (38)', value: 'elasticsearch' },
      { label: 'redis (29)', value: 'redis' },
      { label: 'postgres (52)', value: 'postgres' },
      { label: 'mongodb (31)', value: 'mongodb' },
      { label: 'kafka (47)', value: 'kafka' },
    ];

    const baseMetricTypes = [
      { label: 'request (12)', value: 'request' },
      { label: 'response (0)', value: 'response' },
      { label: 'duration (7)', value: 'duration' },
      { label: 'total (0)', value: 'total' },
      { label: 'latency (8)', value: 'latency' },
      { label: 'errors (5)', value: 'errors' },
      { label: 'bytes (0)', value: 'bytes' },
      { label: 'connections (6)', value: 'connections' },
      { label: 'memory (4)', value: 'memory' },
      { label: 'cpu (9)', value: 'cpu' },
      { label: 'disk (5)', value: 'disk' },
      { label: 'network (7)', value: 'network' },
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
