import { type AdHocVariableFilter, type RawTimeRange } from '@grafana/data';
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

  // this is for otel, if the data source has it, it will be updated here
  hasOtelResources?: boolean;
  useOtelExperience?: boolean;
  isStandardOtel?: boolean;
  nonPromotedOtelResources?: string[];
  initialOtelCheckComplete?: boolean; // updated after the first otel check
  startButtonClicked?: boolean; // from original landing page
  resettingOtel?: boolean; // when switching OTel off from the switch
  addingLabelFromBreakdown?: boolean; // do not use the otel and metrics var subscription when adding label from the breakdown
  afterFirstOtelCheck?: boolean; // don't reset because of the migration on the first otel check from the data source updating

  // Synced with url
  metric?: string;
  metricSearch?: string;

  histogramsLoaded: boolean;
  nativeHistograms: string[];
  nativeHistogramMetric: string;

  trailActivated: boolean; // this indicates that the trail has been updated by metric or filter selected
}
