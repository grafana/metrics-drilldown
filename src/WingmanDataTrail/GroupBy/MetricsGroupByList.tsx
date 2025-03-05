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
        'node_memory_Buffers_bytes',
        'node_filesystem_avail_bytes',
        'node_filesystem_size_bytes',
        'node_disk_io_time_seconds_total',
        'node_disk_reads_completed_total',
        'node_disk_writes_completed_total',
        'node_network_receive_bytes_total',
        'node_network_transmit_bytes_total',
        'node_load1',
        'node_load5',
        'node_load15',
        'node_time_seconds',
        'node_boot_time_seconds',
        'node_memory_SwapTotal_bytes',
        'node_memory_SwapFree_bytes',
        'node_filesystem_files',
        'node_filesystem_files_free',
      ],
    },
    {
      name: 'us-west',
      metrics: ['node_intr_total', 'node_context_switches_total'],
    },
  ],
  namespace: [
    {
      name: 'default',
      metrics: [
        'node_cpu_guest_seconds_total',
        'node_cpu_guest_nice_seconds_total',
        'node_scrape_collector_duration_seconds',
        'node_scrape_collector_success',
        'node_sockstat_sockets_used',
        'node_sockstat_TCP_inuse',
        'node_sockstat_TCP_orphan',
        'node_sockstat_TCP_tw',
        'node_sockstat_TCP_alloc',
        'node_sockstat_TCP_mem',
        'node_sockstat_UDP_inuse',
        'node_sockstat_UDP_mem',
        'node_netstat_Tcp_CurrEstab',
        'node_netstat_Tcp_ActiveOpens',
        'node_netstat_Tcp_PassiveOpens',
        'node_netstat_Tcp_InSegs',
        'node_netstat_Tcp_OutSegs',
        'node_netstat_Udp_InDatagrams',
        'node_netstat_Udp_OutDatagrams',
      ],
    },
    {
      name: 'monitoring',
      metrics: [
        'node_netstat_Udp_InErrors',
        'node_netstat_Icmp_InMsgs',
        'node_netstat_Icmp_OutMsgs',
        'node_netstat_IcmpMsg_InType3',
        'node_netstat_IcmpMsg_OutType3',
        'node_vmstat_pgpgin',
        'node_vmstat_pgpgout',
        'node_vmstat_pswpin',
        'node_vmstat_pswpout',
        'node_vmstat_pgmajfault',
        'node_disk_discards_completed_total',
        'node_disk_discards_merged_total',
        'node_disk_discarded_sectors_total',
        'node_disk_discard_time_seconds_total',
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
