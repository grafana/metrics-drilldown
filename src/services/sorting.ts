import { OutlierDetector, type OutlierOutput } from '@bsull/augurs/outlier';
import {
  doStandardCalcs,
  fieldReducers,
  FieldType,
  outerJoinDataFrames,
  ReducerID,
  type DataFrame,
} from '@grafana/data';
import { memoize } from 'lodash';

import { logger } from 'tracking/logger/logger';
import { localeCompare } from 'WingmanDataTrail/helpers/localCompare';

import { reportExploreMetrics } from '../interactions';
import { getLabelValueFromDataFrame } from './levels';

export type SortSeriesByOption = 'alphabetical' | 'alphabetical-reversed' | 'outliers' | ReducerID.stdDev;
export type SortSeriesDirection = 'asc' | 'desc';

// Alphabetical sort
const sortAlphabetical = (series: DataFrame[], direction: SortSeriesDirection = 'asc') => {
  const compareFn: (a: string, b: string) => number =
    direction === 'asc' ? (a, b) => localeCompare(a, b) : (a, b) => localeCompare(b, a);

  return series.sort((a, b) => {
    const labelA = getLabelValueFromDataFrame(a);
    if (!labelA) {
      return 0;
    }

    const labelB = getLabelValueFromDataFrame(b);
    if (!labelB) {
      return 0;
    }

    return compareFn(labelA, labelB);
  });
};

// Field reducer sort
const sortByFieldReducer = (series: DataFrame[], sortBy: string, direction: SortSeriesDirection = 'asc') => {
  const fieldReducer = fieldReducers.get(sortBy);

  const seriesCalcs = series.map((dataFrame) => {
    const value =
      fieldReducer.reduce?.(dataFrame.fields[1], true, true) ?? doStandardCalcs(dataFrame.fields[1], true, true);

    return {
      value: value[sortBy] ?? 0,
      dataFrame: dataFrame,
    };
  });

  seriesCalcs.sort(direction === 'asc' ? (a, b) => a.value - b.value : (a, b) => b.value - a.value);

  return seriesCalcs.map(({ dataFrame }) => dataFrame);
};

// Outlier sort
const sortByOutliers = (series: DataFrame[], direction: 'asc' | 'desc' = 'asc') => {
  if (!wasmSupported()) {
    throw new Error('WASM not supported');
  }

  const outliers = getOutliers(series);

  const seriesCalcs = series.map((dataFrame, index) => ({
    value: calculateOutlierValue(outliers, index),
    dataFrame: dataFrame,
  }));

  seriesCalcs.sort(direction === 'asc' ? (a, b) => a.value - b.value : (a, b) => b.value - a.value);

  return seriesCalcs.map(({ dataFrame }) => dataFrame);
};

const getOutliers = (series: DataFrame[]): OutlierOutput => {
  // Combine all frames into one by joining on time.
  const joined = outerJoinDataFrames({ frames: series });
  if (!joined) {
    throw new Error('Error while joining frames into a single one');
  }

  // Get number fields: these are our series.
  const joinedSeries = joined.fields.filter((f) => f.type === FieldType.number);
  const points = joinedSeries.map((series) => new Float64Array(series.values.filter(Boolean)));

  return OutlierDetector.dbscan({ sensitivity: 0.4 }).preprocess(points).detect();
};

const calculateOutlierValue = (outliers: OutlierOutput, index: number): number => {
  if (outliers.seriesResults[index].isOutlier) {
    return -outliers.seriesResults[index].outlierIntervals.length;
  }
  return 0;
};

export const sortSeries = memoize(
  (origSeries: DataFrame[], sortBy: SortSeriesByOption, direction: SortSeriesDirection = 'asc') => {
    if (!origSeries.length) {
      return [];
    }

    const series = [...origSeries];

    // Alphabetical sorting
    if (sortBy === 'alphabetical') {
      return sortAlphabetical(series, 'asc');
    }

    if (sortBy === 'alphabetical-reversed') {
      return sortAlphabetical(series, 'desc');
    }

    // Outlier detection sorting
    if (sortBy === 'outliers') {
      try {
        return sortByOutliers(series, direction);
      } catch (e) {
        logger.error(e as Error, { message: 'Error while sorting by outlying series, fallback to stdDev' });
        // ML sorting panicked, fallback to stdDev
        return sortByFieldReducer(series, ReducerID.stdDev, direction);
      }
    }

    // Field reducer sorting (default case)
    return sortByFieldReducer(series, sortBy, direction);
  },
  (series: DataFrame[], sortBy: string, direction: SortSeriesDirection = 'asc') => {
    const firstTimestamp = seriesIsNotEmpty(series) ? series[0].fields[0].values[0] : 0;
    const lastTimestamp = seriesIsNotEmpty(series)
      ? series[series.length - 1].fields[0].values[series[series.length - 1].fields[0].values.length - 1]
      : 0;

    const firstValue = series.length > 0 ? getLabelValueFromDataFrame(series[0]) : '';
    const lastValue = series.length > 0 ? getLabelValueFromDataFrame(series[series.length - 1]) : '';

    const key = `${firstValue}_${lastValue}_${firstTimestamp}_${lastTimestamp}_${series.length}_${sortBy}_${direction}`;

    return key;
  }
);

function seriesIsNotEmpty(series: DataFrame[]) {
  return series.length > 0 && series[0].fields.length > 0 && series[0].fields[0].values.length > 0;
}

export const wasmSupported = () => {
  const support = typeof WebAssembly === 'object';

  if (!support) {
    reportExploreMetrics('wasm_not_supported', {});
  }

  return support;
};
