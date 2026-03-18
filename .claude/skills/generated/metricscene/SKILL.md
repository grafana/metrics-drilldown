---
name: metricscene
description: "Skill for the MetricScene area of metrics-drilldown. 15 symbols across 9 files."
---

# MetricScene

15 symbols | 9 files | Cohesion: 94%

## When to Use

- Working with code in `src/`
- Understanding how getActionViewsDefinitions, RelatedLogsScene, RelatedMetricsScene work
- Modifying metricscene-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/MetricScene/MetricScene.tsx` | _onActivate, subscribeToEvents, updateFromUrl, setActionView, createRelatedLogsScene (+2) |
| `src/MetricScene/MetricActionBar.tsx` | getActionViewsDefinitions |
| `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts` | addRelatedLogsCountChangeHandler |
| `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx` | RelatedLogsScene |
| `src/MetricScene/RelatedMetrics/RelatedMetricsScene.tsx` | RelatedMetricsScene |
| `src/MetricScene/Breakdown/LabelBreakdownScene.tsx` | LabelBreakdownScene |
| `src/MetricScene/QueryResults/QueryResultsScene.tsx` | QueryResultsScene |
| `src/MetricScene/MetricGraphScene.tsx` | MetricGraphScene |
| `src/MetricScene/Breakdown/GroupByVariable.tsx` | GroupByVariable |

## Entry Points

Start here when exploring this area:

- **`getActionViewsDefinitions`** (Function) — `src/MetricScene/MetricActionBar.tsx:41`
- **`RelatedLogsScene`** (Class) — `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx:45`
- **`RelatedMetricsScene`** (Class) — `src/MetricScene/RelatedMetrics/RelatedMetricsScene.tsx:46`
- **`LabelBreakdownScene`** (Class) — `src/MetricScene/Breakdown/LabelBreakdownScene.tsx:32`
- **`QueryResultsScene`** (Class) — `src/MetricScene/QueryResults/QueryResultsScene.tsx:57`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `RelatedLogsScene` | Class | `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx` | 45 |
| `RelatedMetricsScene` | Class | `src/MetricScene/RelatedMetrics/RelatedMetricsScene.tsx` | 46 |
| `LabelBreakdownScene` | Class | `src/MetricScene/Breakdown/LabelBreakdownScene.tsx` | 32 |
| `QueryResultsScene` | Class | `src/MetricScene/QueryResults/QueryResultsScene.tsx` | 57 |
| `MetricGraphScene` | Class | `src/MetricScene/MetricGraphScene.tsx` | 48 |
| `GroupByVariable` | Class | `src/MetricScene/Breakdown/GroupByVariable.tsx` | 23 |
| `getActionViewsDefinitions` | Function | `src/MetricScene/MetricActionBar.tsx` | 41 |
| `_onActivate` | Method | `src/MetricScene/MetricScene.tsx` | 67 |
| `subscribeToEvents` | Method | `src/MetricScene/MetricScene.tsx` | 79 |
| `updateFromUrl` | Method | `src/MetricScene/MetricScene.tsx` | 106 |
| `setActionView` | Method | `src/MetricScene/MetricScene.tsx` | 119 |
| `createRelatedLogsScene` | Method | `src/MetricScene/MetricScene.tsx` | 178 |
| `addRelatedLogsCountChangeHandler` | Method | `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts` | 66 |
| `constructor` | Method | `src/MetricScene/MetricScene.tsx` | 57 |
| `getVariableSet` | Function | `src/MetricScene/MetricScene.tsx` | 185 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Trail → CountLogsLines` | cross_community | 6 |
| `UpdateFromUrl → CountLogsLines` | cross_community | 6 |
| `Trail → RelatedLogsScene` | cross_community | 5 |
| `UpdateFromUrl → RelatedLogsScene` | intra_community | 5 |
| `Trail → LabelBreakdownScene` | cross_community | 4 |
| `Trail → RelatedMetricsScene` | cross_community | 4 |
| `UpdateFromUrl → LabelBreakdownScene` | intra_community | 4 |
| `UpdateFromUrl → RelatedMetricsScene` | intra_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| RelatedLogs | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getActionViewsDefinitions"})` — see callers and callees
2. `gitnexus_query({query: "metricscene"})` — find related execution flows
3. Read key files listed above for implementation details
