---
name: components
description: 'Skill for the Components area of metrics-drilldown. 25 symbols across 15 files.'
---

# Components

25 symbols | 15 files | Cohesion: 85%

## When to Use

- Working with code in `src/`
- Understanding how getMetricDescription, isSceneQueryRunner, removeIgnoreUsageLabel work
- Modifying components-related functionality

## Key Files

| File                                                                | Symbols                                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/shared/GmdVizPanel/components/GmdVizPanelVariantSelector.tsx`  | GmdVizPanelVariantSelector, getDefaultVariantOptions, constructor |
| `src/MetricsReducer/components/SceneByVariableRepeater.tsx`         | constructor, performRepeat, getMultiVariableValues                |
| `src/MetricScene/MetricGraphScene.tsx`                              | constructor, onActivate                                           |
| `src/MetricScene/PanelMenu/actions/OpenAssistantAction.ts`          | OpenAssistantAction, create                                       |
| `src/MetricScene/PanelMenu/actions/CreateAlertAction.ts`            | CreateAlertAction, create                                         |
| `src/MetricScene/PanelMenu/actions/AddToDashboardAction.ts`         | AddToDashboardAction, create                                      |
| `src/shared/utils/utils.queries.ts`                                 | isSceneQueryRunner, removeIgnoreUsageLabel                        |
| `src/MetricScene/RelatedMetrics/PrefixFilterDropdown.tsx`           | onActivate, parseMetricPrefixes                                   |
| `src/MetricScene/MetricActionBar.tsx`                               | MetricActionBar                                                   |
| `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | getMetricDescription                                              |

## Entry Points

Start here when exploring this area:

- **`getMetricDescription`** (Function) — `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts:348`
- **`isSceneQueryRunner`** (Function) — `src/shared/utils/utils.queries.ts:4`
- **`removeIgnoreUsageLabel`** (Function) — `src/shared/utils/utils.queries.ts:27`
- **`create`** (Method) — `src/MetricScene/PanelMenu/actions/OpenAssistantAction.ts:11`
- **`create`** (Method) — `src/MetricScene/PanelMenu/actions/CreateAlertAction.ts:10`

## Key Symbols

| Symbol                       | Type     | File                                                                          | Line |
| ---------------------------- | -------- | ----------------------------------------------------------------------------- | ---- |
| `MetricActionBar`            | Class    | `src/MetricScene/MetricActionBar.tsx`                                         | 119  |
| `OpenAssistantAction`        | Class    | `src/MetricScene/PanelMenu/actions/OpenAssistantAction.ts`                    | 10   |
| `GmdVizPanelVariantSelector` | Class    | `src/shared/GmdVizPanel/components/GmdVizPanelVariantSelector.tsx`            | 27   |
| `CreateAlertAction`          | Class    | `src/MetricScene/PanelMenu/actions/CreateAlertAction.ts`                      | 9    |
| `ConfigurePanelAction`       | Class    | `src/shared/GmdVizPanel/components/ConfigurePanelAction.tsx`                  | 18   |
| `BookmarkAction`             | Class    | `src/MetricScene/PanelMenu/actions/BookmarkAction.ts`                         | 24   |
| `AddToDashboardAction`       | Class    | `src/MetricScene/PanelMenu/actions/AddToDashboardAction.ts`                   | 8    |
| `EventOpenAddToDashboard`    | Class    | `src/shared/GmdVizPanel/components/addToDashboard/EventOpenAddToDashboard.ts` | 9    |
| `getMetricDescription`       | Function | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts`           | 348  |
| `isSceneQueryRunner`         | Function | `src/shared/utils/utils.queries.ts`                                           | 4    |
| `removeIgnoreUsageLabel`     | Function | `src/shared/utils/utils.queries.ts`                                           | 27   |
| `create`                     | Method   | `src/MetricScene/PanelMenu/actions/OpenAssistantAction.ts`                    | 11   |
| `create`                     | Method   | `src/MetricScene/PanelMenu/actions/CreateAlertAction.ts`                      | 10   |
| `create`                     | Method   | `src/MetricScene/PanelMenu/actions/AddToDashboardAction.ts`                   | 9    |
| `getPanelData`               | Function | `src/shared/GmdVizPanel/components/addToDashboard/addToDashboard.ts`          | 6    |
| `computeMetricPrefixGroups`  | Function | `src/MetricsReducer/metrics-variables/computeMetricPrefixGroups.ts`           | 4    |
| `getMultiVariableValues`     | Function | `src/MetricsReducer/components/SceneByVariableRepeater.tsx`                   | 202  |
| `constructor`                | Method   | `src/MetricScene/MetricGraphScene.tsx`                                        | 49   |
| `onActivate`                 | Method   | `src/MetricScene/MetricGraphScene.tsx`                                        | 97   |
| `constructor`                | Method   | `src/MetricsReducer/components/SceneByVariableRepeater.tsx`                   | 46   |

## Execution Flows

| Flow                                        | Type            | Steps |
| ------------------------------------------- | --------------- | ----- |
| `HandleClick → GetTrackedFlagPayload`       | cross_community | 5     |
| `OnActivate → CreatePromURLObject`          | cross_community | 3     |
| `OnActivate → BuildNavigateToMetricsParams` | cross_community | 3     |
| `OnActivate → CreateAppUrl`                 | cross_community | 3     |
| `HandleClick → IsSceneQueryRunner`          | intra_community | 3     |
| `HandleClick → RemoveIgnoreUsageLabel`      | intra_community | 3     |

## Connected Areas

| Area                  | Connections |
| --------------------- | ----------- |
| MetricLabelsList      | 2 calls     |
| Breakdown             | 2 calls     |
| MetricsGroupByList    | 1 calls     |
| MetricLabelValuesList | 1 calls     |
| Extensions            | 1 calls     |
| QuickSearch           | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "getMetricDescription"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
