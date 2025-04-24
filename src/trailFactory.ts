import { SceneTimeRange } from '@grafana/scenes';

import { DataTrail } from './DataTrail';

/**
 * Creates a new metrics trail with the given initial data source and start button clicked state
 * @param initialDS The initial data source
 * @param startButtonClicked Whether the start button was clicked
 * @returns A new DataTrail instance
 */
export function newMetricsTrail(initialDS?: string, startButtonClicked?: boolean): DataTrail {
  return new DataTrail({
    initialDS,
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    embedded: false,
    startButtonClicked,
  });
}
