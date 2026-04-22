---
name: relatedlogs
description: 'Skill for the RelatedLogs area of metrics-drilldown. 12 symbols across 2 files.'
---

# RelatedLogs

12 symbols | 2 files | Cohesion: 75%

## When to Use

- Working with code in `src/`
- Understanding how addLokiDataSourcesChangeHandler, handleFiltersChange, findAndCheckAllDatasources work
- Modifying relatedlogs-related functionality

## Key Files

| File                                                     | Symbols                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx`       | constructor, \_onActivate, showNoLogsFound, \_buildQueryRunner, setupLogsPanel (+2)                                      |
| `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts` | addLokiDataSourcesChangeHandler, handleFiltersChange, findAndCheckAllDatasources, checkLogsInDataSources, countLogsLines |

## Entry Points

Start here when exploring this area:

- **`addLokiDataSourcesChangeHandler`** (Method) — `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts:59`
- **`handleFiltersChange`** (Method) — `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts:73`
- **`findAndCheckAllDatasources`** (Method) — `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts:94`
- **`checkLogsInDataSources`** (Method) — `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts:141`
- **`countLogsLines`** (Method) — `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts:202`

## Key Symbols

| Symbol                               | Type   | File                                                     | Line |
| ------------------------------------ | ------ | -------------------------------------------------------- | ---- |
| `addLokiDataSourcesChangeHandler`    | Method | `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts` | 59   |
| `handleFiltersChange`                | Method | `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts` | 73   |
| `findAndCheckAllDatasources`         | Method | `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts` | 94   |
| `checkLogsInDataSources`             | Method | `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts` | 141  |
| `countLogsLines`                     | Method | `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts` | 202  |
| `constructor`                        | Method | `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx`       | 48   |
| `_onActivate`                        | Method | `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx`       | 66   |
| `showNoLogsFound`                    | Method | `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx`       | 83   |
| `_buildQueryRunner`                  | Method | `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx`       | 91   |
| `setupLogsPanel`                     | Method | `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx`       | 119  |
| `_constructLogsDrilldownLinkContext` | Method | `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx`       | 173  |
| `updateLokiQuery`                    | Method | `src/MetricScene/RelatedLogs/RelatedLogsScene.tsx`       | 199  |

## Execution Flows

| Flow                                     | Type            | Steps |
| ---------------------------------------- | --------------- | ----- |
| `Trail → CountLogsLines`                 | cross_community | 6     |
| `UpdateFromUrl → CountLogsLines`         | cross_community | 6     |
| `SetupLogsPanel → GetTrackedFlagPayload` | cross_community | 5     |

## Connected Areas

| Area           | Connections |
| -------------- | ----------- |
| RelatedMetrics | 1 calls     |
| QuickSearch    | 1 calls     |
| MetricsList    | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "addLokiDataSourcesChangeHandler"})` — see callers and callees
2. `gitnexus_query({query: "relatedlogs"})` — find related execution flows
3. Read key files listed above for implementation details
