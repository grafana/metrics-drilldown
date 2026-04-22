---
name: metricsfiltersection
description: 'Skill for the MetricsFilterSection area of metrics-drilldown. 14 symbols across 4 files.'
---

# MetricsFilterSection

14 symbols | 4 files | Cohesion: 93%

## When to Use

- Working with code in `src/`
- Understanding how computeMetricPrefixSecondLevel, TreeCheckBoxList, isParentChecked work
- Modifying metricsfiltersection-related functionality

## Key Files

| File                                                                                | Symbols                                                                           |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx` | onActivate, updateLists, updateCounts, updateSublevelCounts, updateFromUrl (+1)   |
| `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx`     | TreeCheckBoxList, isParentChecked, getChildren, selectParent, unselectParent (+1) |
| `src/MetricsReducer/metrics-variables/computeMetricPrefixSecondLevel.ts`            | computeMetricPrefixSecondLevel                                                    |
| `src/MetricsReducer/metrics-variables/MetricsVariableFilterEngine.ts`               | getFilters                                                                        |

## Entry Points

Start here when exploring this area:

- **`computeMetricPrefixSecondLevel`** (Function) — `src/MetricsReducer/metrics-variables/computeMetricPrefixSecondLevel.ts:21`
- **`TreeCheckBoxList`** (Function) — `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx:40`
- **`isParentChecked`** (Function) — `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx:52`
- **`getChildren`** (Function) — `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx:59`
- **`selectParent`** (Function) — `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx:64`

## Key Symbols

| Symbol                           | Type     | File                                                                                | Line |
| -------------------------------- | -------- | ----------------------------------------------------------------------------------- | ---- |
| `computeMetricPrefixSecondLevel` | Function | `src/MetricsReducer/metrics-variables/computeMetricPrefixSecondLevel.ts`            | 21   |
| `TreeCheckBoxList`               | Function | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx`     | 40   |
| `isParentChecked`                | Function | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx`     | 52   |
| `getChildren`                    | Function | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx`     | 59   |
| `selectParent`                   | Function | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx`     | 64   |
| `unselectParent`                 | Function | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx`     | 73   |
| `handleChildChange`              | Function | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/TreeCheckBoxList.tsx`     | 81   |
| `getFilters`                     | Method   | `src/MetricsReducer/metrics-variables/MetricsVariableFilterEngine.ts`               | 34   |
| `onActivate`                     | Method   | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx` | 155  |
| `updateLists`                    | Method   | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx` | 202  |
| `updateCounts`                   | Method   | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx` | 209  |
| `updateSublevelCounts`           | Method   | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx` | 259  |
| `updateFromUrl`                  | Method   | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx` | 88   |
| `parseLabel`                     | Method   | `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx` | 322  |

## Execution Flows

| Flow                                          | Type            | Steps |
| --------------------------------------------- | --------------- | ----- |
| `OnActivate → BuildRegex`                     | cross_community | 5     |
| `OnActivate → ApplyPrefixFilters`             | cross_community | 4     |
| `OnActivate → ApplySuffixFilters`             | cross_community | 4     |
| `OnActivate → ApplyNameFilters`               | cross_community | 4     |
| `OnActivate → ComputeMetricPrefixSecondLevel` | intra_community | 4     |

## Connected Areas

| Area              | Connections |
| ----------------- | ----------- |
| QuickSearch       | 1 calls     |
| Metrics-variables | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "computeMetricPrefixSecondLevel"})` — see callers and callees
2. `gitnexus_query({query: "metricsfiltersection"})` — find related execution flows
3. Read key files listed above for implementation details
