---
name: timeseries
description: "Skill for the Timeseries area of metrics-drilldown. 13 symbols across 8 files."
---

# Timeseries

13 symbols | 8 files | Cohesion: 84%

## When to Use

- Working with code in `src/`
- Understanding how getColorByIndex, getUnitFromMetric, getUnit work
- Modifying timeseries-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/shared/GmdVizPanel/units/getUnit.ts` | getUnitFromMetric, getUnit, getPerSecondRateUnit |
| `src/shared/GmdVizPanel/types/timeseries/getTimeseriesQueryRunnerParams.ts` | getTimeseriesQueryRunnerParams, buildGroupByQueries, buildQueriesWithPresetFunctions |
| `src/shared/GmdVizPanel/types/timeseries/buildTimeseriesPanel.ts` | buildTimeseriesPanel, buildGroupByPanel |
| `src/shared/utils/utils.ts` | getColorByIndex |
| `src/shared/GmdVizPanel/types/percentiles/buildPercentilesPanel.ts` | buildPercentilesPanel |
| `src/shared/GmdVizPanel/behaviors/extremeValueFilterBehavior/isAllDataNaN.ts` | isAllDataNaN |
| `src/shared/GmdVizPanel/behaviors/extremeValueFilterBehavior/extremeValueFilterBehavior.tsx` | extremeValueFilterBehavior |
| `src/shared/GmdVizPanel/types/timeseries/behaviors/updateColorsWhenQueriesChange.ts` | updateColorsWhenQueriesChange |

## Entry Points

Start here when exploring this area:

- **`getColorByIndex`** (Function) — `src/shared/utils/utils.ts:27`
- **`getUnitFromMetric`** (Function) — `src/shared/GmdVizPanel/units/getUnit.ts:30`
- **`getUnit`** (Function) — `src/shared/GmdVizPanel/units/getUnit.ts:44`
- **`getPerSecondRateUnit`** (Function) — `src/shared/GmdVizPanel/units/getUnit.ts:49`
- **`getTimeseriesQueryRunnerParams`** (Function) — `src/shared/GmdVizPanel/types/timeseries/getTimeseriesQueryRunnerParams.ts:12`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getColorByIndex` | Function | `src/shared/utils/utils.ts` | 27 |
| `getUnitFromMetric` | Function | `src/shared/GmdVizPanel/units/getUnit.ts` | 30 |
| `getUnit` | Function | `src/shared/GmdVizPanel/units/getUnit.ts` | 44 |
| `getPerSecondRateUnit` | Function | `src/shared/GmdVizPanel/units/getUnit.ts` | 49 |
| `getTimeseriesQueryRunnerParams` | Function | `src/shared/GmdVizPanel/types/timeseries/getTimeseriesQueryRunnerParams.ts` | 12 |
| `buildTimeseriesPanel` | Function | `src/shared/GmdVizPanel/types/timeseries/buildTimeseriesPanel.ts` | 15 |
| `buildPercentilesPanel` | Function | `src/shared/GmdVizPanel/types/percentiles/buildPercentilesPanel.ts` | 11 |
| `isAllDataNaN` | Function | `src/shared/GmdVizPanel/behaviors/extremeValueFilterBehavior/isAllDataNaN.ts` | 12 |
| `extremeValueFilterBehavior` | Function | `src/shared/GmdVizPanel/behaviors/extremeValueFilterBehavior/extremeValueFilterBehavior.tsx` | 27 |
| `updateColorsWhenQueriesChange` | Function | `src/shared/GmdVizPanel/types/timeseries/behaviors/updateColorsWhenQueriesChange.ts` | 15 |
| `buildGroupByQueries` | Function | `src/shared/GmdVizPanel/types/timeseries/getTimeseriesQueryRunnerParams.ts` | 34 |
| `buildQueriesWithPresetFunctions` | Function | `src/shared/GmdVizPanel/types/timeseries/getTimeseriesQueryRunnerParams.ts` | 63 |
| `buildGroupByPanel` | Function | `src/shared/GmdVizPanel/types/timeseries/buildTimeseriesPanel.ts` | 72 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExtremeValueFilterBehavior → GetTrackedFlagPayload` | cross_community | 5 |
| `BuildTimeseriesPanel → ExpressionToString` | cross_community | 5 |
| `Constructor → ExpressionToString` | cross_community | 4 |
| `BuildPercentilesPanel → ExpressionToString` | cross_community | 4 |
| `ExtremeValueFilterBehavior → ExpressionToString` | cross_community | 4 |
| `BuildTimeseriesPanel → BuildGroupByQueries` | intra_community | 4 |
| `BuildTimeseriesPanel → BuildQueriesWithPresetFunctions` | intra_community | 4 |
| `BuildTimeseriesPanel → GetUnitFromMetric` | intra_community | 4 |
| `Constructor → BuildGroupByQueries` | cross_community | 3 |
| `Constructor → BuildQueriesWithPresetFunctions` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Stat | 2 calls |
| QuickSearch | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getColorByIndex"})` — see callers and callees
2. `gitnexus_query({query: "timeseries"})` — find related execution flows
3. Read key files listed above for implementation details
