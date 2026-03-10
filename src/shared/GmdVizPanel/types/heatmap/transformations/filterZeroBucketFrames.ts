import { type DataFrame } from '@grafana/data';
import { map, type Observable } from 'rxjs';

// When all observations in a native histogram metric fall near zero, Prometheus returns a valid
// heatmap-cells frame where every bucket boundary is the zero bucket sentinel (yMin = -1e-128,
// yMax = 1e-128). This frame has real data (non-zero counts) but is mathematically unrenderable
// on a log-scale Y axis — Math.log of a negative or near-zero value produces NaN, triggering
// an infinite loop in logAxisSplits that crashes the browser tab.
// Filtering these frames out causes the panel to show "No data" instead of crashing.
function isZeroBucketOnlyFrame(frame: DataFrame): boolean {
  const yMinField = frame.fields.find((f) => f.name === 'yMin');

  if (!yMinField) {
    return false;
  }

  return (yMinField.values as number[]).every((v) => v <= 0);
}

export const filterZeroBucketFrames = () => (source: Observable<DataFrame[]>) =>
  source.pipe(map((frames: DataFrame[]) => frames.filter((frame) => !isZeroBucketOnlyFrame(frame))));
