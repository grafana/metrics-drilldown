---
name: labels
description: 'Skill for the Labels area of metrics-drilldown. 12 symbols across 4 files.'
---

# Labels

12 symbols | 4 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how displayWarning, metricFindQuery, fetchLabelValues work
- Modifying labels-related functionality

## Key Files

| File                                                                | Symbols                                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/MetricsReducer/labels/LabelsDataSource.ts`                     | metricFindQuery, fetchLabelValues, fetchLabels, getLabelsMatchAPISupport, getFiltersFromVariable (+1) |
| `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | fetchLabelValues, getPrometheusDataSourceForScene, fetchLabels                                        |
| `src/MetricsReducer/labels/LabelsVariable.tsx`                      | onActivate, updateQuery                                                                               |
| `src/MetricsReducer/helpers/displayStatus.ts`                       | displayWarning                                                                                        |

## Entry Points

Start here when exploring this area:

- **`displayWarning`** (Function) — `src/MetricsReducer/helpers/displayStatus.ts:19`
- **`metricFindQuery`** (Method) — `src/MetricsReducer/labels/LabelsDataSource.ts:51`
- **`fetchLabelValues`** (Method) — `src/MetricsReducer/labels/LabelsDataSource.ts:133`
- **`fetchLabelValues`** (Method) — `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts:258`
- **`getPrometheusDataSourceForScene`** (Method) — `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts:287`

## Key Symbols

| Symbol                            | Type     | File                                                                | Line |
| --------------------------------- | -------- | ------------------------------------------------------------------- | ---- |
| `displayWarning`                  | Function | `src/MetricsReducer/helpers/displayStatus.ts`                       | 19   |
| `metricFindQuery`                 | Method   | `src/MetricsReducer/labels/LabelsDataSource.ts`                     | 51   |
| `fetchLabelValues`                | Method   | `src/MetricsReducer/labels/LabelsDataSource.ts`                     | 133  |
| `fetchLabelValues`                | Method   | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 258  |
| `getPrometheusDataSourceForScene` | Method   | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 287  |
| `fetchLabels`                     | Method   | `src/MetricsReducer/labels/LabelsDataSource.ts`                     | 76   |
| `getLabelsMatchAPISupport`        | Method   | `src/MetricsReducer/labels/LabelsDataSource.ts`                     | 107  |
| `getFiltersFromVariable`          | Method   | `src/MetricsReducer/labels/LabelsDataSource.ts`                     | 119  |
| `processLabelOptions`             | Method   | `src/MetricsReducer/labels/LabelsDataSource.ts`                     | 129  |
| `fetchLabels`                     | Method   | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 214  |
| `onActivate`                      | Method   | `src/MetricsReducer/labels/LabelsVariable.tsx`                      | 40   |
| `updateQuery`                     | Method   | `src/MetricsReducer/labels/LabelsVariable.tsx`                      | 89   |

## Execution Flows

| Flow                                       | Type            | Steps |
| ------------------------------------------ | --------------- | ----- |
| `MetricFindQuery → IsPrometheusDataSource` | cross_community | 5     |
| `MetricFindQuery → DisplayError`           | cross_community | 4     |
| `MetricFindQuery → DisplayWarning`         | cross_community | 4     |
| `MetricFindQuery → IsAdHocFiltersVariable` | cross_community | 4     |

## Connected Areas

| Area                   | Connections |
| ---------------------- | ----------- |
| MetricDatasourceHelper | 1 calls     |
| Breakdown              | 1 calls     |
| Bookmarks              | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "displayWarning"})` — see callers and callees
2. `gitnexus_query({query: "labels"})` — find related execution flows
3. Read key files listed above for implementation details
