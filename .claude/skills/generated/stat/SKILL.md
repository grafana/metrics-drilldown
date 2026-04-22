---
name: stat
description: 'Skill for the Stat area of metrics-drilldown. 12 symbols across 8 files.'
---

# Stat

12 symbols | 8 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how buildQueryExpression, getStatushistoryQueryRunnerParams, buildStatushistoryPanel work
- Modifying stat-related functionality

## Key Files

| File                                                                              | Symbols                                                                          |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/shared/GmdVizPanel/types/percentiles/getPercentilesQueryRunnerParams.ts`     | getPercentilesQueryRunnerParams, buildHistogramQueries, buildNonHistogramQueries |
| `src/shared/GmdVizPanel/buildQueryExpression.ts`                                  | expressionToString, buildQueryExpression                                         |
| `src/shared/GmdVizPanel/types/stat/getStatQueryRunnerParams.ts`                   | getStatQueryRunnerParams, buildQueriesWithPresetFunctions                        |
| `src/shared/GmdVizPanel/types/statushistory/getStatushistoryQueryRunnerParams.ts` | getStatushistoryQueryRunnerParams                                                |
| `src/shared/GmdVizPanel/types/statushistory/buildStatushistoryPanel.ts`           | buildStatushistoryPanel                                                          |
| `src/shared/GmdVizPanel/types/stat/buildStatPanel.ts`                             | buildStatPanel                                                                   |
| `src/shared/GmdVizPanel/types/heatmap/getHeatmapQueryRunnerParams.ts`             | getHeatmapQueryRunnerParams                                                      |
| `src/shared/GmdVizPanel/types/heatmap/buildHeatmapPanel.ts`                       | buildHeatmapPanel                                                                |

## Entry Points

Start here when exploring this area:

- **`buildQueryExpression`** (Function) — `src/shared/GmdVizPanel/buildQueryExpression.ts:25`
- **`getStatushistoryQueryRunnerParams`** (Function) — `src/shared/GmdVizPanel/types/statushistory/getStatushistoryQueryRunnerParams.ts:7`
- **`buildStatushistoryPanel`** (Function) — `src/shared/GmdVizPanel/types/statushistory/buildStatushistoryPanel.ts:9`
- **`getStatQueryRunnerParams`** (Function) — `src/shared/GmdVizPanel/types/stat/getStatQueryRunnerParams.ts:11`
- **`buildStatPanel`** (Function) — `src/shared/GmdVizPanel/types/stat/buildStatPanel.ts:9`

## Key Symbols

| Symbol                              | Type     | File                                                                              | Line |
| ----------------------------------- | -------- | --------------------------------------------------------------------------------- | ---- |
| `buildQueryExpression`              | Function | `src/shared/GmdVizPanel/buildQueryExpression.ts`                                  | 25   |
| `getStatushistoryQueryRunnerParams` | Function | `src/shared/GmdVizPanel/types/statushistory/getStatushistoryQueryRunnerParams.ts` | 7    |
| `buildStatushistoryPanel`           | Function | `src/shared/GmdVizPanel/types/statushistory/buildStatushistoryPanel.ts`           | 9    |
| `getStatQueryRunnerParams`          | Function | `src/shared/GmdVizPanel/types/stat/getStatQueryRunnerParams.ts`                   | 11   |
| `buildStatPanel`                    | Function | `src/shared/GmdVizPanel/types/stat/buildStatPanel.ts`                             | 9    |
| `getHeatmapQueryRunnerParams`       | Function | `src/shared/GmdVizPanel/types/heatmap/getHeatmapQueryRunnerParams.ts`             | 7    |
| `buildHeatmapPanel`                 | Function | `src/shared/GmdVizPanel/types/heatmap/buildHeatmapPanel.ts`                       | 14   |
| `getPercentilesQueryRunnerParams`   | Function | `src/shared/GmdVizPanel/types/percentiles/getPercentilesQueryRunnerParams.ts`     | 13   |
| `expressionToString`                | Function | `src/shared/GmdVizPanel/buildQueryExpression.ts`                                  | 13   |
| `buildQueriesWithPresetFunctions`   | Function | `src/shared/GmdVizPanel/types/stat/getStatQueryRunnerParams.ts`                   | 31   |
| `buildHistogramQueries`             | Function | `src/shared/GmdVizPanel/types/percentiles/getPercentilesQueryRunnerParams.ts`     | 35   |
| `buildNonHistogramQueries`          | Function | `src/shared/GmdVizPanel/types/percentiles/getPercentilesQueryRunnerParams.ts`     | 76   |

## Execution Flows

| Flow                                              | Type            | Steps |
| ------------------------------------------------- | --------------- | ----- |
| `BuildTimeseriesPanel → ExpressionToString`       | cross_community | 5     |
| `Constructor → ExpressionToString`                | cross_community | 4     |
| `BuildPercentilesPanel → ExpressionToString`      | cross_community | 4     |
| `ExtremeValueFilterBehavior → ExpressionToString` | cross_community | 4     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Timeseries | 2 calls     |

## How to Explore

1. `gitnexus_context({name: "buildQueryExpression"})` — see callers and callees
2. `gitnexus_query({query: "stat"})` — find related execution flows
3. Read key files listed above for implementation details
