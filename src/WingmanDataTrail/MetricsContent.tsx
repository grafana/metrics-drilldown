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

interface MetricsContentState extends SceneObjectState {}

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

export class MetricsContent extends SceneObjectBase<MetricsContentState> {
  constructor(state: Partial<MetricsContentState>) {
    super({
      ...state,
      key: '',
    });
  }

  private MetricsContent = () => {
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
        // us-east
        const metricsList = groupFlavor.metrics;
        // for each key make a SceneCSSGridItem and put it in a SceneCSSGridLayout header row
        // This could be a component instead
        const header = new SceneCSSGridItem({
          gridColumn: '1/-1',
          body: PanelBuilders.text()
            .setTitle(`${groupName} ${group}`)
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
  public static Component = ({ model }: SceneComponentProps<MetricsContent>) => {
    return <model.MetricsContent />;
  };
}

function createMetricPanel(title: string) {
  return new SceneCSSGridItem({
    body: PanelBuilders.timeseries().setTitle(title).setOption('legend', { showLegend: false }).build(),
  });
}
