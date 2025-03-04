import {
  PanelBuilders,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';

interface MetricsGroupByListState extends SceneObjectState {}

// Add new component interface
interface MetricsGroupByRowState extends SceneObjectState {
  groupName: string;
  groupType: string;
  metricsList: string[];
}

const groups: any = {
  cluster: [
    {
      name: 'us-east',
      metrics: ['alloy_request_duration_hello', 'grafana_total_mem_total', 'grafana_request_duration'],
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
};

export class MetricsGroupByList extends SceneObjectBase<MetricsGroupByListState> {
  constructor(state: Partial<MetricsGroupByListState>) {
    super({
      ...state,
      key: '',
    });
  }

  private MetricsGroupByList = () => {
    // start with the overview
    // extract to a new file - to have a clear separation for responsibility
    // if there are GROUPS, otherwise we just do a normal layout

    // separate the complexity and use the variability
    // see a different thing, make a new component

    // the main content should be the element in the [1] index of the body

    // WHEN ADDDING ELEMENTS TO THE PANEL LIST,
    // TO GET DIFFERENT GRID OPTIONS FOR BOTH THE
    // GROUP HEADER AND THE PANELS FOR THE GROUP,
    // THERE NEEDS TO BE NESTED
    // iterate through the keys of grouped metrics.
    // each key currently is a metric prefix
    const children: Array<SceneObject<SceneObjectState> | SceneCSSGridItem> = [];
    for (const group in groups) {
      const groupFlavors = groups[group];
      // cluster => cluster value => [metrics]
      // iterate over the groupFlavors
      for (const groupFlavor of groupFlavors) {
        const groupName = groupFlavor.name;
        const metricsList = groupFlavor.metrics;

        // Create instance of the new component
        const metricsGroupByRow = new MetricsGroupByRow({
          groupName,
          groupType: group,
          metricsList,
        });

        children.push(metricsGroupByRow);
      }
    }

    const allGroups = new SceneCSSGridLayout({
      children,
      templateColumns: '1/-1',
      autoRows: 'auto',
      rowGap: 0.5,
    });

    // const rowTemplate = showPreviews ? ROW_PREVIEW_HEIGHT : ROW_CARD_HEIGHT;
    return <allGroups.Component model={allGroups} />;
  };

  // this should be rendered to create a static component to render the function above
  public static Component = ({ model }: SceneComponentProps<MetricsGroupByList>) => {
    return <model.MetricsGroupByList />;
  };
}

// New component class
export class MetricsGroupByRow extends SceneObjectBase<MetricsGroupByRowState> {
  public constructor(state: Partial<MetricsGroupByRowState>) {
    super({
      ...state,
      groupName: state.groupName || '',
      groupType: state.groupType || '',
      metricsList: state.metricsList || [],
      key: `${state.groupName || ''}-${state.groupType || ''}`,
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const { groupName, groupType, metricsList } = model.state;

    // Create the header
    const header = new SceneCSSGridItem({
      gridColumn: '1/-1',
      body: PanelBuilders.text()
        .setTitle(`${groupName} ${groupType}`)
        .setOption('content', '')
        .setDisplayMode('transparent')
        .build(),
    });

    const headerRow = new SceneCSSGridLayout({
      children: [header],
      templateColumns: '1/-1',
      autoRows: '30px',
      key: groupName,
    });

    // Create the metrics row
    const metricChildren: Array<SceneObject<SceneObjectState> | SceneCSSGridItem> = [];

    for (const metric of metricsList) {
      const metricPanel = createMetricPanel(metric);
      metricChildren.push(metricPanel);
    }

    const metricsRow = new SceneCSSGridLayout({
      children: metricChildren,
      // templateColumns: 'repeat(3, minmax(0, 1fr))',
      // autoRows: height,
      isLazy: true,
      key: groupName + 'metrics',
    });

    // Create container for both rows
    const container = new SceneCSSGridLayout({
      children: [headerRow, metricsRow],
      templateColumns: '1/-1',
      autoRows: 'auto',
      rowGap: 0.5,
      key: `${groupName}-${groupType}-container`,
    });

    return <container.Component model={container} />;
  };
}

function createMetricPanel(title: string) {
  return new SceneCSSGridItem({
    body: PanelBuilders.timeseries().setTitle(title).setOption('legend', { showLegend: false }).build(),
  });
}
