import { type DataFrame } from '@grafana/data';
import { map, type Observable } from 'rxjs';

// Native histogram panels can receive empty HeatmapCells frames when a label facet has no data.
// Passing empty frames to the heatmap panel causes uPlot to call the log-scale Y axis range
// function with null, which triggers an infinite loop in logAxisSplits and crashes the tab.
// Filtering them out here causes the panel to show "No data" instead of crashing.
export const filterEmptyFrames = () => (source: Observable<DataFrame[]>) =>
  source.pipe(map((frames: DataFrame[]) => frames.filter((frame) => frame.length > 0)));
