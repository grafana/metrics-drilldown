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

interface MetricsGroupByListState extends SceneObjectState {
  groupBy?: string;
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
    const { groupBy = 'cluster' } = this.state;
    const currentGroups = groups[groupBy] || [];

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

    // Use the currentGroups variable which is filtered by the selected groupBy value
    for (const groupFlavor of currentGroups) {
      const groupName = groupFlavor.name;
      // us-east
      const metricsList = groupFlavor.metrics;
      // for each key make a SceneCSSGridItem and put it in a SceneCSSGridLayout header row
      // This could be a component instead
      const header = new SceneCSSGridItem({
        gridColumn: '1/-1',
        body: PanelBuilders.text()
          .setTitle(`${groupName} ${groupBy}`)
          .setOption('content', `${metricsList.length} metrics`)
          .build(),
      });

      const headerRow = new SceneCSSGridLayout({
        children: [header],
        templateColumns: '1/-1',
        autoRows: '30px',
        key: groupName,
      });

      children.push(headerRow);

      // then iterate through the metrics to create a SceneCSSGridLayout of metrics childern
      const metricChildren: Array<SceneObject<SceneObjectState> | SceneCSSGridItem> = [];

      // variable repeater?
      for (let index = 0; index < metricsList.length; index++) {
        const metric = metricsList[index];
        //
        const metricPanel = createMetricPanel(metric);
        metricChildren.push(metricPanel);
      }

      const row = new SceneCSSGridLayout({
        children: metricChildren,
        // templateColumns: 'repeat(3, minmax(0, 1fr))',
        // autoRows: height,
        isLazy: true,
        key: groupName + 'metrics',
      });

      children.push(row);
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

function createMetricPanel(title: string) {
  return new SceneCSSGridItem({
    body: PanelBuilders.timeseries().setTitle(title).setOption('legend', { showLegend: false }).build(),
  });
}
