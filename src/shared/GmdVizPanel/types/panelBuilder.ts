import { type SceneDataQuery, type VizPanel } from '@grafana/scenes';

import { type PanelConfig, type QueryConfig } from '../GmdVizPanel';
import { type PanelType } from './available-panel-types';
import { type Metric } from '../matchers/getMetricType';
import { buildHeatmapPanel } from './heatmap/buildHeatmapPanel';
import { getHeatmapQueryRunnerParams } from './heatmap/getHeatmapQueryRunnerParams';
import { buildPercentilesPanel } from './percentiles/buildPercentilesPanel';
import { getPercentilesQueryRunnerParams } from './percentiles/getPercentilesQueryRunnerParams';
import { buildStatPanel } from './stat/buildStatPanel';
import { getStatQueryRunnerParams } from './stat/getStatQueryRunnerParams';
import { buildStatushistoryPanel } from './statushistory/buildStatushistoryPanel';
import { getStatushistoryQueryRunnerParams } from './statushistory/getStatushistoryQueryRunnerParams';
import { buildTimeseriesPanel } from './timeseries/buildTimeseriesPanel';
import { getTimeseriesQueryRunnerParams } from './timeseries/getTimeseriesQueryRunnerParams';

type BuildVizPanelOptions = {
  metric: Metric;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

type GetAllQueryRunnerParamsOptions = {
  panelType: PanelType;
  metric: Metric;
  queryConfig: QueryConfig;
};

export type GetQueryRunnerParamsOptions = {
  metric: Metric;
  queryConfig: QueryConfig;
};

export type QueryRunnerParams = {
  maxDataPoints: number;
  queries: SceneDataQuery[];
  isRateQuery?: boolean;
};

export type Builders = {
  buildVizPanel: (options: BuildVizPanelOptions) => VizPanel;
  getQueryRunnerParams: (options: GetQueryRunnerParamsOptions) => QueryRunnerParams;
};

export const PANEL_TYPE_TO_BUILDERS_LOOKUP = new Map<PanelType, Builders>([
  [
    'timeseries',
    {
      buildVizPanel: buildTimeseriesPanel,
      getQueryRunnerParams: getTimeseriesQueryRunnerParams,
    },
  ],
  [
    'heatmap',
    {
      buildVizPanel: buildHeatmapPanel,
      getQueryRunnerParams: getHeatmapQueryRunnerParams,
    },
  ],
  [
    'percentiles',
    {
      buildVizPanel: buildPercentilesPanel,
      getQueryRunnerParams: getPercentilesQueryRunnerParams,
    },
  ],
  [
    'statushistory',
    {
      buildVizPanel: buildStatushistoryPanel,
      getQueryRunnerParams: getStatushistoryQueryRunnerParams,
    },
  ],
  [
    'stat',
    {
      buildVizPanel: buildStatPanel,
      getQueryRunnerParams: getStatQueryRunnerParams,
    },
  ],
]);

export const panelBuilder = {
  buildVizPanel(options: BuildVizPanelOptions) {
    const buildersForPanelType = PANEL_TYPE_TO_BUILDERS_LOOKUP.get(options.panelConfig.type);

    if (!buildersForPanelType) {
      throw new TypeError(`Unsupported panel type "${options.panelConfig.type}"!`);
    }

    return buildersForPanelType.buildVizPanel(options);
  },
  getQueryRunnerParams(options: GetAllQueryRunnerParamsOptions) {
    const { metric, queryConfig, panelType } = options;

    const buildersForPanelType = PANEL_TYPE_TO_BUILDERS_LOOKUP.get(panelType);

    if (!buildersForPanelType) {
      throw new TypeError(`Unsupported panel type "${panelType}"!`);
    }

    return buildersForPanelType.getQueryRunnerParams({ metric, queryConfig });
  },
};
