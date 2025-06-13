import { type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

export function fixLegendForUnspecifiedLabelValueBehavior(vizPanel: VizPanel) {
  vizPanel.state.$data?.subscribeToState((newState) => {
    const target = newState.data?.request?.targets[0];
    if (hasLegendFormat(target)) {
      const { legendFormat } = target;
      // Assume {{label}}
      const label = legendFormat.slice(2, -2);

      newState.data?.series.forEach((series) => {
        if (!series.fields[1]?.labels?.[label]) {
          const labels = series.fields[1]?.labels;
          if (labels) {
            labels[label] = `<unspecified ${label}>`;
          }
        }
      });
    }
  });
}

function hasLegendFormat(target: DataQuery | undefined): target is DataQuery & { legendFormat: string } {
  return target !== undefined && 'legendFormat' in target && typeof target.legendFormat === 'string';
}
