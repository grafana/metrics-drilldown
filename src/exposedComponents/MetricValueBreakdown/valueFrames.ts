import { FieldType, type DataFrame } from '@grafana/data';

export const DEFAULT_MAX_VALUES = 6;
export const HARD_MAX_VALUES = 24;

export interface ValueFrame {
  value: string;
  frame: DataFrame;
  hasSamples: boolean;
}

/** Raw labels, never the app's <unspecified> display sentinel, define callback matchers. */
export function getValueFrames(series: DataFrame[], label: string): ValueFrame[] {
  return series
    .flatMap((frame) => {
      const field = frame.fields.find((field) => field.type === FieldType.number);
      return field
        ? [{ value: field.labels?.[label] ?? '', frame, hasSamples: field.values.some(Number.isFinite) }]
        : [];
    })
    .sort((a, b) => {
      if (a.value === b.value) {
        return 0;
      }
      return a.value < b.value ? -1 : 1;
    });
}

/** Shared bounds make the displayed grouped computations visually comparable. */
export function getSharedBounds(items: ValueFrame[]) {
  let min = 0;
  let max = 0;
  for (const value of finiteValues(items)) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max: max === min ? min + 1 : max };
}

function* finiteValues(items: ValueFrame[]) {
  for (const { frame } of items) {
    for (const field of frame.fields.filter((field) => field.type === FieldType.number)) {
      yield* field.values.filter(Number.isFinite) as number[];
    }
  }
}
