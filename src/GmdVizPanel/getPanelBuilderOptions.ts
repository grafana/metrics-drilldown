import { type Expression } from 'tsqtsq';

import { buildHeatmapQuery } from './heatmap/buildHeatmapQuery';
import { isHistogramQuery } from './heatmap/isHistogramQuery';
import { buildStatusHistoryQuery } from './statushistory/buildStatusHistoryQuery';
import { isUpDownMetric } from './statushistory/isUpDownMetric';
import { buildTimeseriesQuery } from './timeseries/buildTimeseriesQuery';
import { getPerSecondRateUnit, getUnit } from './units/getUnit';

export type PanelQueryParams = {
  fnName: string;
  isRateQuery: boolean;
  query: string;
  expression: Expression;
  maxDataPoints: number;
  format?: string;
};

type PanelOptions = {
  type: 'timeseries' | 'heatmap' | 'statushistory';
  unit: string;
  query: PanelQueryParams;
  fixedColor?: string;
};

export type PanelBuilderOptions = {
  metric: string;
  isNativeHistogram?: boolean;
  default: PanelOptions;
  variants: PanelOptions[];
};

export type LabelMatcher = {
  key: string;
  operator: string;
  value: string;
};

export function getPanelBuilderOptions({
  metric,
  matchers,
  isNativeHistogram,
  fixedColor,
}: {
  metric: string;
  matchers: LabelMatcher[];
  isNativeHistogram: boolean;
  fixedColor?: string;
}): PanelBuilderOptions {
  if (isUpDownMetric(metric)) {
    return {
      metric,
      default: {
        type: 'statushistory',
        unit: 'none',
        query: buildStatusHistoryQuery(metric, matchers),
        fixedColor,
      },
      variants: [],
    };
  }

  if (isNativeHistogram || isHistogramQuery(metric)) {
    return {
      metric,
      isNativeHistogram,
      default: {
        type: 'heatmap',
        unit: getUnit(metric),
        query: buildHeatmapQuery(metric, isNativeHistogram, matchers),
        fixedColor,
      },
      variants: [],
    };
  }

  const query = buildTimeseriesQuery(metric, matchers);

  return {
    metric,
    default: {
      type: 'timeseries',
      unit: query.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric),
      query,
      fixedColor,
    },
    variants: [],
  };
}
