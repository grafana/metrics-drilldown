import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsFilterSection } from './MetricsFilterSection';

interface SideBarState extends SceneObjectState {
  hideEmptyGroups: boolean;
  hideEmptyTypes: boolean;
  selectedMetricGroups: string[];
  selectedMetricTypes: string[];
  metricsGroupSearch: string;
  metricsTypeSearch: string;
}

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

export class SideBar extends SceneObjectBase<SideBarState> {
  constructor(state: Partial<SideBarState>) {
    super({
      ...state,
      key: 'sidebar',
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

  public static Component = ({ model }: SceneComponentProps<SideBar>) => {
    const styles = useStyles2(getStyles);
    const {
      hideEmptyGroups,
      hideEmptyTypes,
      selectedMetricGroups,
      selectedMetricTypes,
      metricsGroupSearch,
      metricsTypeSearch,
    } = model.useState();

    return (
      <div className={styles.sidebar}>
        <MetricsFilterSection
          title="Metrics group"
          items={baseMetricGroups}
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
