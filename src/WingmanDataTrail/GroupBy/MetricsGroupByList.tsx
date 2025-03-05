import {
  SceneCSSGridLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneCSSGridItem,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';

import { MetricsGroupByRow } from './MetricsGroupByRow';

interface MetricsGroupByListState extends SceneObjectState {}

const groups: any = {
  cluster: [
    {
      name: 'us-east',
      metrics: [
        'node_cpu_seconds_total',
        'node_memory_MemTotal_bytes',
        'node_memory_MemFree_bytes',
        'node_memory_Cached_bytes',
      ],
    },
    {
      name: 'us-west',
      metrics: [
        'node_memory_Buffers_bytes',
        'node_filesystem_avail_bytes',
        'node_filesystem_size_bytes',
        'node_disk_io_time_seconds_total',
      ],
    },
  ],
  namespace: [
    {
      name: 'default',
      metrics: [
        'node_disk_io_time_seconds_total',
        'node_disk_reads_completed_total',
        'node_disk_writes_completed_total',
        'node_network_receive_bytes_total',
        'node_network_transmit_bytes_total',
        'node_load1',
      ],
    },
    {
      name: 'monitoring',
      metrics: [
        'node_load5',
        'node_load15',
        'node_time_seconds',
        'node_boot_time_seconds',
        'node_memory_SwapTotal_bytes',
        'node_memory_SwapFree_bytes',
      ],
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
