import { type AdHocVariableFilter } from '@grafana/data';
import { type SceneObject, type SceneObjectState, type SceneReactObject } from '@grafana/scenes';

import { type DataTrailSettings } from './DataTrailSettings';

export interface DataTrailState extends SceneObjectState {
  topScene?: SceneObject;
  embedded?: boolean;
  controls: SceneObject[];
  settings: DataTrailSettings;
  pluginInfo: SceneReactObject;
  createdAt: number;

  // wingman
  dashboardMetrics?: Record<string, number>;
  alertingMetrics?: Record<string, number>;

  // just for the starting data source
  initialDS?: string;
  initialFilters?: AdHocVariableFilter[];

  // Synced with url
  metric?: string;
  metricSearch?: string;

  histogramsLoaded: boolean;
  nativeHistograms: string[];
  nativeHistogramMetric: string;

  trailActivated: boolean; // this indicates that the trail has been updated by metric or filter selected
}
