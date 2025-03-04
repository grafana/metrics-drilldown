import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import {
  SceneObjectBase,
  type SceneComponentProps,
  type SceneCSSGridLayout,
  type SceneObjectState,
} from '@grafana/scenes';
import { Checkbox, Field, FieldSet, Icon, Input, RadioButtonGroup, Select, useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsContent } from './MetricsContent';

interface MetricsReducerState extends SceneObjectState {
  body: SceneCSSGridLayout;
  searchQuery: string;
  groupBy: string;
  sortBy: string;
  viewMode: 'rows' | 'grid';
  hideEmpty: boolean;
  selectedMetricGroups: string[];
  selectedMetricTypes: string[];
  groups: Record<string, Array<{ name: string; metrics: string[] }>>;
}

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  public constructor(state: any) {
    const initialState: MetricsReducerState = {
      ...state,
      groups: {
        cluster: [
          {
            name: 'us-east',
            metrics: ['alloy_request_duration', 'grafana_total_mem_total', 'grafana_request_duration'],
          },
          {
            name: 'us-west',
            metrics: ['alloy_request_duration', 'grafana_total_mem_total', 'grafana_request_duration'],
          },
        ],
        namespace: [
          {
            name: 'default',
            metrics: ['alloy_request_duration', 'grafana_total_mem_total', 'grafana_request_duration'],
          },
          {
            name: 'monitoring',
            metrics: ['alloy_request_duration', 'grafana_total_mem_total', 'grafana_request_duration'],
          },
        ],
      },
      searchQuery: '',
      groupBy: 'cluster',
      sortBy: 'name',
      viewMode: 'grid' as const,
      hideEmpty: true,
      selectedMetricGroups: [],
      selectedMetricTypes: [],
      body: new MetricsContent({}),
    };

    super(initialState);
  }

  private MetricsSidebar = () => {
    const { hideEmpty, selectedMetricGroups, selectedMetricTypes } = this.useState();
    const styles = useStyles2(getStyles);

    const metricGroups = [
      { label: 'All', value: 'all' },
      { label: 'alloy (57)', value: 'alloy' },
      { label: 'apollo (12)', value: 'apollo' },
      { label: 'grafana (33)', value: 'grafana' },
    ];

    const metricTypes = [
      { label: 'All', value: 'all' },
      { label: 'request (12)', value: 'request' },
      { label: 'response (4)', value: 'response' },
      { label: 'duration (7)', value: 'duration' },
      { label: 'total (2)', value: 'total' },
    ];

    return (
      <div className={styles.sidebar}>
        <FieldSet label="Metrics group">
          <Field>
            <Checkbox
              label="Hide empty"
              value={hideEmpty}
              onChange={(e) => this.setState({ hideEmpty: e.currentTarget.checked })}
            />
          </Field>
          <Field>
            <Input prefix={<Icon name="search" />} placeholder="Search..." />
          </Field>
          {metricGroups.map((group) => (
            <Field key={group.value}>
              <Checkbox
                label={group.label}
                value={selectedMetricGroups.includes(group.value)}
                onChange={(e) => {
                  const newGroups = e.currentTarget.checked
                    ? [...selectedMetricGroups, group.value]
                    : selectedMetricGroups.filter((g) => g !== group.value);
                  this.setState({ selectedMetricGroups: newGroups });
                }}
              />
            </Field>
          ))}
        </FieldSet>

        <FieldSet label="Metrics types">
          <Field>
            <Checkbox label="Hide empty" value={hideEmpty} />
          </Field>
          <Field>
            <Input prefix={<Icon name="search" />} placeholder="Search..." />
          </Field>
          {metricTypes.map((type) => (
            <Field key={type.value}>
              <Checkbox
                label={type.label}
                value={selectedMetricTypes.includes(type.value)}
                onChange={(e) => {
                  const newTypes = e.currentTarget.checked
                    ? [...selectedMetricTypes, type.value]
                    : selectedMetricTypes.filter((t) => t !== type.value);
                  this.setState({ selectedMetricTypes: newTypes });
                }}
              />
            </Field>
          ))}
        </FieldSet>
      </div>
    );
  };

  public static Component = ({ model }: SceneComponentProps<MetricsReducer>) => {
    const { body, searchQuery, groupBy, sortBy, viewMode } = model.useState();
    const styles = useStyles2(getStyles);

    const groupByOptions: Array<SelectableValue<string>> = [
      { label: '(None)', value: 'none' },
      { label: 'Cluster', value: 'cluster' },
      { label: 'Namespace', value: 'namespace' },
      { label: 'Service', value: 'service' },
    ];

    const sortByOptions: Array<SelectableValue<string>> = [
      { label: 'Name', value: 'name' },
      { label: 'Value', value: 'value' },
    ];

    const viewModeOptions = [
      { label: 'Grid', value: 'grid' as const },
      { label: 'Rows', value: 'rows' as const },
    ];

    return (
      <div className={styles.container}>
        <div className={styles.controls}>
          <Field className={styles.searchField}>
            <Input
              prefix={<Icon name="search" />}
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => model.setState({ searchQuery: e.currentTarget.value })}
            />
          </Field>

          <Field label="Group by">
            <Select value={groupBy} options={groupByOptions} onChange={(v) => model.setState({ groupBy: v.value! })} />
          </Field>

          <Field label="Sort">
            <Select value={sortBy} options={sortByOptions} onChange={(v) => model.setState({ sortBy: v.value! })} />
          </Field>

          <Field label="View">
            <RadioButtonGroup
              options={viewModeOptions}
              value={viewMode}
              onChange={(v) => model.setState({ viewMode: v as 'grid' | 'rows' })}
            />
          </Field>
        </div>
        <div className={styles.content}>
          <model.MetricsSidebar />
          <div className={styles.mainContent}>
            <body.Component model={body} />
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
    controls: css({
      display: 'flex',
      gap: theme.spacing(2),
      padding: theme.spacing(1),
      alignItems: 'flex-end',
      position: 'sticky',
      top: 0,
      backgroundColor: theme.colors.background.primary,
      zIndex: 1,
    }),
    searchField: css({
      flexGrow: 1,
      marginBottom: 0,
    }),
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
      overflow: 'auto',
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    }),
    mainContent: css({
      flexGrow: 1,
      overflow: 'auto',
      padding: theme.spacing(1),
    }),
    clusterSection: css({
      marginBottom: theme.spacing(3),
      '& h3': {
        marginBottom: theme.spacing(2),
      },
    }),
  };
}
