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

// Add new component interface
interface MetricsGroupByRowState extends SceneObjectState {
  groupName: string;
  groupType: string;
  metricsList: string[];
}

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
