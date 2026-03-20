---
name: relatedmetrics
description: "Skill for the RelatedMetrics area of metrics-drilldown. 13 symbols across 11 files."
---

# RelatedMetrics

13 symbols | 11 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how signalOnQueryComplete, LoadQueryScene, FilteredMetricsVariable work
- Modifying relatedmetrics-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/MetricScene/RelatedMetrics/RelatedMetricsScene.tsx` | constructor, onActivate, subscribeToEvents |
| `src/MetricsReducer/MetricsReducer.tsx` | constructor |
| `src/MetricScene/MetricActionBar.tsx` | constructor |
| `src/shared/savedQueries/LoadQueryScene.tsx` | LoadQueryScene |
| `src/MetricsReducer/metrics-variables/FilteredMetricsVariable.ts` | FilteredMetricsVariable |
| `src/MetricsReducer/list-controls/ListControls.tsx` | ListControls |
| `src/MetricsReducer/SideBar/SideBar.tsx` | SideBar |
| `src/MetricScene/RelatedMetrics/RelatedListControls.tsx` | RelatedListControls |
| `src/MetricScene/EventActionViewDataLoadComplete.ts` | EventActionViewDataLoadComplete |
| `src/MetricScene/utils/signalOnQueryComplete.ts` | signalOnQueryComplete |

## Entry Points

Start here when exploring this area:

- **`signalOnQueryComplete`** (Function) — `src/MetricScene/utils/signalOnQueryComplete.ts:17`
- **`LoadQueryScene`** (Class) — `src/shared/savedQueries/LoadQueryScene.tsx:25`
- **`FilteredMetricsVariable`** (Class) — `src/MetricsReducer/metrics-variables/FilteredMetricsVariable.ts:8`
- **`ListControls`** (Class) — `src/MetricsReducer/list-controls/ListControls.tsx:27`
- **`SideBar`** (Class) — `src/MetricsReducer/SideBar/SideBar.tsx:93`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `LoadQueryScene` | Class | `src/shared/savedQueries/LoadQueryScene.tsx` | 25 |
| `FilteredMetricsVariable` | Class | `src/MetricsReducer/metrics-variables/FilteredMetricsVariable.ts` | 8 |
| `ListControls` | Class | `src/MetricsReducer/list-controls/ListControls.tsx` | 27 |
| `SideBar` | Class | `src/MetricsReducer/SideBar/SideBar.tsx` | 93 |
| `RelatedListControls` | Class | `src/MetricScene/RelatedMetrics/RelatedListControls.tsx` | 28 |
| `EventActionViewDataLoadComplete` | Class | `src/MetricScene/EventActionViewDataLoadComplete.ts` | 15 |
| `signalOnQueryComplete` | Function | `src/MetricScene/utils/signalOnQueryComplete.ts` | 17 |
| `constructor` | Method | `src/MetricsReducer/MetricsReducer.tsx` | 55 |
| `constructor` | Method | `src/MetricScene/MetricActionBar.tsx` | 120 |
| `constructor` | Method | `src/MetricScene/RelatedMetrics/RelatedMetricsScene.tsx` | 47 |
| `onActivate` | Method | `src/MetricScene/RelatedMetrics/RelatedMetricsScene.tsx` | 62 |
| `subscribeToEvents` | Method | `src/MetricScene/RelatedMetrics/RelatedMetricsScene.tsx` | 70 |
| `onActivate` | Method | `src/MetricScene/QueryResults/QueryResultsScene.tsx` | 89 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnActivate → BuildRegex` | cross_community | 7 |
| `OnActivate → ApplyPrefixFilters` | cross_community | 6 |
| `OnActivate → ApplySuffixFilters` | cross_community | 6 |
| `OnActivate → ApplyNameFilters` | cross_community | 6 |
| `OnActivate → NotifyUpdate` | cross_community | 5 |
| `OnActivate → MetricsVariableFilterEngine` | cross_community | 4 |
| `OnActivate → MetricsVariableSortEngine` | cross_community | 4 |
| `OnActivate → SetInitOptions` | cross_community | 4 |
| `OnActivate → EventActionViewDataLoadComplete` | intra_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Metrics-variables | 2 calls |
| MetricsReducer | 1 calls |

## How to Explore

1. `gitnexus_context({name: "signalOnQueryComplete"})` — see callers and callees
2. `gitnexus_query({query: "relatedmetrics"})` — find related execution flows
3. Read key files listed above for implementation details
