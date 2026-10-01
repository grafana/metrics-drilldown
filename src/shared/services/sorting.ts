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

import { displayWarning } from 'MetricsReducer/helpers/displayStatus';
import { localeCompare } from 'MetricsReducer/helpers/localCompare';

import { getLabelValueFromDataFrame } from './levels';

export type SortSeriesByOption = 'alphabetical' | 'alphabetical-reversed' | 'outliers' | ReducerID.stdDev;
type SortSeriesDirection = 'asc' | 'desc';

// Different metrics can have identical labels and timestamps, so cache by exact frame identity.
const dataFrameIds = new WeakMap<DataFrame, number>();
let nextDataFrameId = 0;

function getDataFrameId(frame: DataFrame): number {
  const existingId = dataFrameIds.get(frame);
  if (existingId !== undefined) {
    return existingId;
  }

  const id = nextDataFrameId++;
  dataFrameIds.set(frame, id);
  return id;
}

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
    const field = dataFrame.fields[1];
    if (!field) {
      return {
        value: 0,
        dataFrame,
      };
    }

    const value = fieldReducer.reduce?.(field, true, true) ?? doStandardCalcs(field, true, true);
    return {
      value: value[sortBy] ?? 0,
      dataFrame,
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
  const points = joinedSeries.map((series) => new Float64Array(series.values));

  return OutlierDetector.dbscan({ sensitivity: 0.9 }).detect(points);
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
        const msg = `Error while sorting by outlying series: "${(e as Error).toString()}"!`;
        displayWarning([msg, 'Falling back to standard deviation to identify the most variable series.']);

        return sortByFieldReducer(series, ReducerID.stdDev, direction);
      }
    }

    // Field reducer sorting (default case)
    return sortByFieldReducer(series, sortBy, direction);
  },
  (series: DataFrame[], sortBy: string, direction: SortSeriesDirection = 'asc') => {
    const seriesIdentity = series.map(getDataFrameId).join('_');
    return `${seriesIdentity}_${sortBy}_${direction}`;
  }
);

export const wasmSupported = () => typeof WebAssembly === 'object';
