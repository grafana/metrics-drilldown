import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  type SceneCSSGridItem,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';

import { MetricsGroupByRow } from './MetricsGroupByRow';

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

export class MetricsGroupByList extends EmbeddedScene {
  constructor() {
    super({
      key: 'metrics-group-list',
      body: new SceneFlexLayout({
        direction: 'column',
        children: [],
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const children: Array<SceneObject<SceneObjectState> | SceneCSSGridItem> = [];
    for (const group in groups) {
      const groupFlavors = groups[group];
      // cluster => cluster value => [metrics]
      // iterate over the groupFlavors
      for (const groupFlavor of groupFlavors) {
        const groupName = groupFlavor.name;
        const metricsList = groupFlavor.metrics;

        children.push(
          new SceneFlexItem({
            body: new MetricsGroupByRow({
              groupName,
              groupType: group,
              metricsList,
            }),
          })
        );
      }
    }

    (this.state.body as SceneFlexLayout).setState({
      children,
    });
  }
}
