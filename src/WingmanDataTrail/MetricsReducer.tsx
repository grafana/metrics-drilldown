import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  PanelBuilders,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneFlexItemLike,
  type SceneFlexItemState,
  type SceneObjectState,
} from '@grafana/scenes';
import { Checkbox, Field, FieldSet, Icon, Input, useStyles2 } from '@grafana/ui';
import React from 'react';

import { HeaderControls } from './HeaderControls/HeaderControls';

interface MetricsReducerState extends SceneObjectState {
  headerControls: HeaderControls;
  body: SceneCSSGridLayout;
  hideEmpty: boolean;
  selectedMetricGroups: string[];
  selectedMetricTypes: string[];
}

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  private createMetricPanel(title: string) {
    return new SceneCSSGridItem({
      body: PanelBuilders.timeseries().setTitle(title).setOption('legend', { showLegend: false }).build(),
    });
  }

  public constructor(state: any) {
    const initialState: MetricsReducerState = {
      ...state,
      headerControls: new HeaderControls({}),
      hideEmpty: true,
      selectedMetricGroups: [],
      selectedMetricTypes: [],
      body: new SceneCSSGridLayout({
        templateColumns: '250px 1fr',
        children: [
          // Left sidebar
          new SceneCSSGridItem({
            body: new SceneFlexLayout({
              direction: 'column',
              children: [],
            }),
          }),
          // Main content
          new SceneCSSGridItem({
            body: new SceneFlexLayout({
              direction: 'column',
              children: [
                new SceneFlexLayout({
                  direction: 'column',
                  children: [
                    // us-west cluster
                    new SceneFlexItem({
                      body: new SceneCSSGridLayout({
                        templateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        children: [],
                      }),
                    }) as SceneFlexItemLike,
                    // south-east cluster
                    new SceneFlexItem({
                      body: new SceneCSSGridLayout({
                        templateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        children: [],
                      }),
                    }) as SceneFlexItemLike,
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
    };

    super(initialState);

    // Add metric panels after super() call
    const mainContent = (initialState.body.state.children[1] as SceneCSSGridItem).state as SceneFlexItemState;
    const clusterLayout = (mainContent.body as SceneFlexLayout).state.children[0] as SceneFlexLayout;

    const usWestGrid = ((clusterLayout.state.children[0] as SceneFlexItem).state as SceneFlexItemState)
      .body as SceneCSSGridLayout;
    usWestGrid.setState({
      children: [
        this.createMetricPanel('alloy_request_duration'),
        this.createMetricPanel('grafana_total_mem_total'),
        this.createMetricPanel('grafana_request_duration'),
      ],
    });

    const southEastGrid = ((clusterLayout.state.children[1] as SceneFlexItem).state as SceneFlexItemState)
      .body as SceneCSSGridLayout;
    southEastGrid.setState({
      children: [
        this.createMetricPanel('alloy_request_duration'),
        this.createMetricPanel('grafana_total_mem_total'),
        this.createMetricPanel('grafana_request_duration'),
      ],
    });
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
            <div className={styles.clusterSection}>
              <h3>us-west cluster</h3>
              <body.Component model={body} />
            </div>
            <div className={styles.clusterSection}>
              <h3>south-east cluster</h3>
              <body.Component model={body} />
            </div>
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
