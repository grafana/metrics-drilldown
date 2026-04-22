---
name: appdatatrail
description: 'Skill for the AppDataTrail area of metrics-drilldown. 28 symbols across 17 files.'
---

# AppDataTrail

28 symbols | 17 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how getAppBackgroundColor, isPrometheusDataSource, MetricsReducer work
- Modifying appdatatrail-related functionality

## Key Files

| File                                                                     | Symbols                                                                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/AppDataTrail/DataTrail.tsx`                                         | updateFromUrl, onActivate, updateStateForNewMetric, handleMetricSelectedEvent, openAddToDashboardModal (+5) |
| `src/AppDataTrail/MetricsDrilldownDataSourceVariable.ts`                 | MetricsDrilldownDataSourceVariable, constructor, getCurrentDataSource                                       |
| `src/MetricsReducer/MetricsReducer.tsx`                                  | MetricsReducer                                                                                              |
| `src/MetricScene/MetricScene.tsx`                                        | MetricScene                                                                                                 |
| `src/MetricsReducer/labels/LabelsDataSource.ts`                          | LabelsDataSource                                                                                            |
| `src/AppDataTrail/header/SelectNewMetricButton.tsx`                      | SelectNewMetricButton                                                                                       |
| `src/MetricsReducer/metrics-variables/MetricsVariable.ts`                | MetricsVariable                                                                                             |
| `src/MetricsReducer/metrics-variables/AdHocFiltersForMetricsVariable.ts` | AdHocFiltersForMetricsVariable                                                                              |
| `src/MetricsReducer/labels/LabelsVariable.tsx`                           | LabelsVariable                                                                                              |
| `src/MetricsReducer/components/SceneDrawer.tsx`                          | SceneDrawer                                                                                                 |

## Entry Points

Start here when exploring this area:

- **`getAppBackgroundColor`** (Function) — `src/shared/utils/utils.styles.ts:4`
- **`isPrometheusDataSource`** (Function) — `src/shared/utils/utils.datasource.ts:18`
- **`MetricsReducer`** (Class) — `src/MetricsReducer/MetricsReducer.tsx:47`
- **`MetricScene`** (Class) — `src/MetricScene/MetricScene.tsx:38`
- **`LabelsDataSource`** (Class) — `src/MetricsReducer/labels/LabelsDataSource.ts:24`

## Key Symbols

| Symbol                               | Type     | File                                                                     | Line |
| ------------------------------------ | -------- | ------------------------------------------------------------------------ | ---- |
| `MetricsReducer`                     | Class    | `src/MetricsReducer/MetricsReducer.tsx`                                  | 47   |
| `MetricScene`                        | Class    | `src/MetricScene/MetricScene.tsx`                                        | 38   |
| `LabelsDataSource`                   | Class    | `src/MetricsReducer/labels/LabelsDataSource.ts`                          | 24   |
| `SelectNewMetricButton`              | Class    | `src/AppDataTrail/header/SelectNewMetricButton.tsx`                      | 13   |
| `MetricsDrilldownDataSourceVariable` | Class    | `src/AppDataTrail/MetricsDrilldownDataSourceVariable.ts`                 | 10   |
| `MetricsVariable`                    | Class    | `src/MetricsReducer/metrics-variables/MetricsVariable.ts`                | 28   |
| `AdHocFiltersForMetricsVariable`     | Class    | `src/MetricsReducer/metrics-variables/AdHocFiltersForMetricsVariable.ts` | 10   |
| `LabelsVariable`                     | Class    | `src/MetricsReducer/labels/LabelsVariable.tsx`                           | 21   |
| `SceneDrawer`                        | Class    | `src/MetricsReducer/components/SceneDrawer.tsx`                          | 12   |
| `getAppBackgroundColor`              | Function | `src/shared/utils/utils.styles.ts`                                       | 4    |
| `isPrometheusDataSource`             | Function | `src/shared/utils/utils.datasource.ts`                                   | 18   |
| `updateFromUrl`                      | Method   | `src/AppDataTrail/DataTrail.tsx`                                         | 117  |
| `onActivate`                         | Method   | `src/AppDataTrail/DataTrail.tsx`                                         | 149  |
| `updateStateForNewMetric`            | Method   | `src/AppDataTrail/DataTrail.tsx`                                         | 171  |
| `handleMetricSelectedEvent`          | Method   | `src/AppDataTrail/DataTrail.tsx`                                         | 280  |
| `openAddToDashboardModal`            | Method   | `src/AppDataTrail/DataTrail.tsx`                                         | 361  |
| `constructor`                        | Method   | `src/AppDataTrail/DataTrail.tsx`                                         | 127  |
| `constructor`                        | Method   | `src/AppDataTrail/MetricsDrilldownDataSourceVariable.ts`                 | 11   |
| `getCurrentDataSource`               | Method   | `src/AppDataTrail/MetricsDrilldownDataSourceVariable.ts`                 | 38   |
| `getBaseFiltersForMetric`            | Function | `src/AppDataTrail/DataTrail.tsx`                                         | 547  |

## Execution Flows

| Flow                                                | Type            | Steps |
| --------------------------------------------------- | --------------- | ----- |
| `OnActivate → IsPrometheusDataSource`               | cross_community | 6     |
| `OnActivate → GetQueryMetricsMetadata`              | cross_community | 5     |
| `OnActivate → GetLoadMetricsMetadata`               | cross_community | 5     |
| `HandleMetricSelectedEvent → BuildStorageKey`       | cross_community | 5     |
| `HandleMetricSelectedEvent → GetTrackedFlagPayload` | cross_community | 5     |
| `MetricFindQuery → IsPrometheusDataSource`          | cross_community | 5     |
| `HandleMetricSelectedEvent → GetTrailFor`           | cross_community | 4     |
| `HandleMetricSelectedEvent → FetchRecentMetrics`    | cross_community | 4     |
| `OnActivate → DisplayError`                         | cross_community | 3     |
| `OnActivate → SelectNewMetricButton`                | intra_community | 3     |

## Connected Areas

| Area                   | Connections |
| ---------------------- | ----------- |
| Bookmarks              | 2 calls     |
| QuickSearch            | 2 calls     |
| MetricDatasourceHelper | 1 calls     |
| Tracking               | 1 calls     |
| Actions                | 1 calls     |
| User-preferences       | 1 calls     |
| Metrics-variables      | 1 calls     |
| Breakdown              | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "getAppBackgroundColor"})` — see callers and callees
2. `gitnexus_query({query: "appdatatrail"})` — find related execution flows
3. Read key files listed above for implementation details
