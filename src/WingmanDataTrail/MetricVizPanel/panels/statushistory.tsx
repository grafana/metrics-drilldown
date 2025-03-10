import { PanelBuilders, type SceneQueryRunner } from '@grafana/scenes';
import { MappingType, ThresholdsMode, VisibilityMode } from '@grafana/schema';

interface PanelProps {
  panelTitle: string;
  queryRunner: SceneQueryRunner;
}

export function buildStatusHistoryPanel({ panelTitle, queryRunner }: PanelProps) {
  queryRunner.setState({ maxDataPoints: 100 });

  return (
    PanelBuilders.statushistory()
      .setTitle(panelTitle)
      .setData(queryRunner)
      .setColor({ mode: 'thresholds' }) // Set color mode to enable threshold coloring
      .setMappings([
        {
          type: MappingType.ValueToText,
          options: {
            '0': {
              color: 'red',
              text: 'down',
            },
            '1': {
              color: 'green',
              text: 'up',
            },
          },
        },
      ])
      .setThresholds({
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: 0, color: 'red' },
          { value: 1, color: 'green' },
        ],
      })
      // Hide the threshold annotations
      .setOption('legend', { showLegend: false })
      .setOption('showValue', VisibilityMode.Never)
  );
}
