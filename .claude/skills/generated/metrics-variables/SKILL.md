---
name: metrics-variables
description: "Skill for the Metrics-variables area of metrics-drilldown. 35 symbols across 15 files."
---

# Metrics-variables

35 symbols | 15 files | Cohesion: 89%

## When to Use

- Working with code in `src/`
- Understanding how sortRelatedMetrics, sortMetricsByCount, sortMetricsAlphabetically work
- Modifying metrics-variables-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/MetricsReducer/metrics-variables/MetricsVariableFilterEngine.ts` | MetricsVariableFilterEngine, setInitOptions, applyFilters, notifyUpdate, getFilteredOptions (+5) |
| `src/MetricsReducer/metrics-variables/MetricsVariable.ts` | onActivate, fetchAllOrRecentMetrics, fetchAllMetrics, fetchRecentMetrics, constructor |
| `src/MetricsReducer/metrics-variables/MetricsVariableSortEngine.ts` | sort, sortByUsage, notifyUpdate, MetricsVariableSortEngine |
| `src/MetricsReducer/list-controls/MetricsSorter/MetricsSorter.tsx` | sortMetricsByCount, sortMetricsAlphabetically, sortMetricsWithRecentFirst |
| `src/MetricScene/RelatedMetrics/sortRelatedMetrics.ts` | sortRelatedMetrics, getLevenDistances |
| `src/MetricsReducer/metrics-variables/computeRulesGroups.ts` | isRecordingRule, computeRulesGroups |
| `src/MetricsReducer/MetricsReducer.tsx` | initVariablesFilteringAndSorting |
| `src/MetricScene/RelatedMetrics/RelatedMetricsScene.tsx` | initVariablesFilteringAndSorting |
| `src/AppDataTrail/DataTrail.tsx` | fetchRecentMetrics |
| `src/MetricsReducer/SideBar/sections/RecentMetricsSection/RecentMetricsSection.tsx` | update |

## Entry Points

Start here when exploring this area:

- **`sortRelatedMetrics`** (Function) — `src/MetricScene/RelatedMetrics/sortRelatedMetrics.ts:2`
- **`sortMetricsByCount`** (Function) — `src/MetricsReducer/list-controls/MetricsSorter/MetricsSorter.tsx:188`
- **`sortMetricsAlphabetically`** (Function) — `src/MetricsReducer/list-controls/MetricsSorter/MetricsSorter.tsx:209`
- **`sortMetricsWithRecentFirst`** (Function) — `src/MetricsReducer/list-controls/MetricsSorter/MetricsSorter.tsx:221`
- **`withLifecycleEvents`** (Function) — `src/MetricsReducer/metrics-variables/withLifecycleEvents.ts:18`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `MetricsVariableSortEngine` | Class | `src/MetricsReducer/metrics-variables/MetricsVariableSortEngine.ts` | 15 |
| `MetricsVariableFilterEngine` | Class | `src/MetricsReducer/metrics-variables/MetricsVariableFilterEngine.ts` | 13 |
| `EventMetricsVariableLoaded` | Class | `src/MetricsReducer/metrics-variables/events/EventMetricsVariableLoaded.ts` | 8 |
| `EventMetricsVariableDeactivated` | Class | `src/MetricsReducer/metrics-variables/events/EventMetricsVariableDeactivated.ts` | 6 |
| `EventMetricsVariableActivated` | Class | `src/MetricsReducer/metrics-variables/events/EventMetricsVariableActivated.ts` | 6 |
| `sortRelatedMetrics` | Function | `src/MetricScene/RelatedMetrics/sortRelatedMetrics.ts` | 2 |
| `sortMetricsByCount` | Function | `src/MetricsReducer/list-controls/MetricsSorter/MetricsSorter.tsx` | 188 |
| `sortMetricsAlphabetically` | Function | `src/MetricsReducer/list-controls/MetricsSorter/MetricsSorter.tsx` | 209 |
| `sortMetricsWithRecentFirst` | Function | `src/MetricsReducer/list-controls/MetricsSorter/MetricsSorter.tsx` | 221 |
| `withLifecycleEvents` | Function | `src/MetricsReducer/metrics-variables/withLifecycleEvents.ts` | 18 |
| `computeRulesGroups` | Function | `src/MetricsReducer/metrics-variables/computeRulesGroups.ts` | 22 |
| `sort` | Method | `src/MetricsReducer/metrics-variables/MetricsVariableSortEngine.ts` | 26 |
| `sortByUsage` | Method | `src/MetricsReducer/metrics-variables/MetricsVariableSortEngine.ts` | 71 |
| `notifyUpdate` | Method | `src/MetricsReducer/metrics-variables/MetricsVariableSortEngine.ts` | 89 |
| `initVariablesFilteringAndSorting` | Method | `src/MetricsReducer/MetricsReducer.tsx` | 114 |
| `setInitOptions` | Method | `src/MetricsReducer/metrics-variables/MetricsVariableFilterEngine.ts` | 27 |
| `applyFilters` | Method | `src/MetricsReducer/metrics-variables/MetricsVariableFilterEngine.ts` | 66 |
| `notifyUpdate` | Method | `src/MetricsReducer/metrics-variables/MetricsVariableFilterEngine.ts` | 195 |
| `initVariablesFilteringAndSorting` | Method | `src/MetricScene/RelatedMetrics/RelatedMetricsScene.tsx` | 96 |
| `fetchRecentMetrics` | Method | `src/AppDataTrail/DataTrail.tsx` | 357 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnActivate → BuildRegex` | cross_community | 7 |
| `OnActivate → BuildRegex` | cross_community | 7 |
| `OnActivate → ApplyPrefixFilters` | cross_community | 6 |
| `OnActivate → ApplySuffixFilters` | cross_community | 6 |
| `OnActivate → ApplyNameFilters` | cross_community | 6 |
| `OnActivate → ApplyPrefixFilters` | cross_community | 6 |
| `OnActivate → ApplySuffixFilters` | cross_community | 6 |
| `OnActivate → ApplyNameFilters` | cross_community | 6 |
| `OnActivate → BuildRegex` | cross_community | 5 |
| `OnActivate → NotifyUpdate` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| QuickSearch | 1 calls |
| MetricLabelsList | 1 calls |
| User-preferences | 1 calls |

## How to Explore

1. `gitnexus_context({name: "sortRelatedMetrics"})` — see callers and callees
2. `gitnexus_query({query: "metrics-variables"})` — find related execution flows
3. Read key files listed above for implementation details
