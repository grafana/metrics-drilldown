---
name: quicksearch
description: 'Skill for the QuickSearch area of metrics-drilldown. 25 symbols across 17 files.'
---

# QuickSearch

25 symbols | 17 files | Cohesion: 75%

## When to Use

- Working with code in `src/`
- Understanding how reportExploreMetrics, getTrackedFlagPayload, OpenInLogsDrilldownButton work
- Modifying quicksearch-related functionality

## Key Files

| File                                                                            | Symbols                                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/MetricsReducer/list-controls/QuickSearch/QuickSearch.tsx`                  | QuickSearch, updateValue, handleChange, handleAiButtonClick, useHumanFriendlyCountsMessage |
| `src/shared/tracking/interactions.ts`                                           | getExperimentPayloads, enrichPayload, reportExploreMetrics                                 |
| `src/MetricsReducer/list-controls/QuickSearch/QuickSearch.test.tsx`             | MockCountsProvider, createQuickSearch                                                      |
| `src/MetricsReducer/list-controls/QuickSearch/CountsProvider/CountsProvider.ts` | CountsProvider, useCounts                                                                  |
| `src/MetricsReducer/list-controls/ListControls.tsx`                             | constructor                                                                                |
| `src/MetricsReducer/list-controls/LayoutSwitcher.tsx`                           | LayoutSwitcher                                                                             |
| `src/MetricScene/RelatedMetrics/RelatedListControls.tsx`                        | constructor                                                                                |
| `src/MetricScene/RelatedMetrics/PrefixFilterDropdown.tsx`                       | PrefixFilterDropdown                                                                       |
| `src/MetricsReducer/list-controls/MetricsSorter/MetricsSorter.tsx`              | MetricsSorter                                                                              |
| `src/MetricScene/Breakdown/MetricLabelValuesList/LabelValuesCountProvider.ts`   | LabelValuesCountsProvider                                                                  |

## Entry Points

Start here when exploring this area:

- **`reportExploreMetrics`** (Function) — `src/shared/tracking/interactions.ts:256`
- **`getTrackedFlagPayload`** (Function) — `src/shared/featureFlags/tracking.ts:37`
- **`OpenInLogsDrilldownButton`** (Function) — `src/MetricScene/RelatedLogs/OpenInLogsDrilldownButton.tsx:15`
- **`openQuickSearchAssistant`** (Function) — `src/MetricsReducer/list-controls/QuickSearch/QuickSearchAssistant.ts:33`
- **`handleChange`** (Function) — `src/MetricsReducer/list-controls/QuickSearch/QuickSearch.tsx:206`

## Key Symbols

| Symbol                          | Type     | File                                                                                          | Line |
| ------------------------------- | -------- | --------------------------------------------------------------------------------------------- | ---- |
| `LayoutSwitcher`                | Class    | `src/MetricsReducer/list-controls/LayoutSwitcher.tsx`                                         | 32   |
| `PrefixFilterDropdown`          | Class    | `src/MetricScene/RelatedMetrics/PrefixFilterDropdown.tsx`                                     | 40   |
| `QuickSearch`                   | Class    | `src/MetricsReducer/list-controls/QuickSearch/QuickSearch.tsx`                                | 35   |
| `MetricsSorter`                 | Class    | `src/MetricsReducer/list-controls/MetricsSorter/MetricsSorter.tsx`                            | 106  |
| `LabelValuesCountsProvider`     | Class    | `src/MetricScene/Breakdown/MetricLabelValuesList/LabelValuesCountProvider.ts`                 | 6    |
| `SortBySelector`                | Class    | `src/MetricScene/Breakdown/MetricLabelValuesList/SortBySelector.tsx`                          | 40   |
| `MetricVariableCountsProvider`  | Class    | `src/MetricsReducer/list-controls/QuickSearch/CountsProvider/MetricVariableCountsProvider.ts` | 8    |
| `CountsProvider`                | Class    | `src/MetricsReducer/list-controls/QuickSearch/CountsProvider/CountsProvider.ts`               | 11   |
| `reportExploreMetrics`          | Function | `src/shared/tracking/interactions.ts`                                                         | 256  |
| `getTrackedFlagPayload`         | Function | `src/shared/featureFlags/tracking.ts`                                                         | 37   |
| `OpenInLogsDrilldownButton`     | Function | `src/MetricScene/RelatedLogs/OpenInLogsDrilldownButton.tsx`                                   | 15   |
| `openQuickSearchAssistant`      | Function | `src/MetricsReducer/list-controls/QuickSearch/QuickSearchAssistant.ts`                        | 33   |
| `handleChange`                  | Function | `src/MetricsReducer/list-controls/QuickSearch/QuickSearch.tsx`                                | 206  |
| `handleAiButtonClick`           | Function | `src/MetricsReducer/list-controls/QuickSearch/QuickSearch.tsx`                                | 222  |
| `constructor`                   | Method   | `src/MetricsReducer/list-controls/ListControls.tsx`                                           | 28   |
| `constructor`                   | Method   | `src/MetricScene/RelatedMetrics/RelatedListControls.tsx`                                      | 29   |
| `constructor`                   | Method   | `src/MetricScene/Breakdown/MetricLabelValuesList/MetricLabelValuesList.tsx`                   | 54   |
| `updateValue`                   | Method   | `src/MetricsReducer/list-controls/QuickSearch/QuickSearch.tsx`                                | 104  |
| `useHumanFriendlyCountsMessage` | Method   | `src/MetricsReducer/list-controls/QuickSearch/QuickSearch.tsx`                                | 151  |
| `useCounts`                     | Method   | `src/MetricsReducer/list-controls/QuickSearch/CountsProvider/CountsProvider.ts`               | 19   |

## Execution Flows

| Flow                                                | Type            | Steps |
| --------------------------------------------------- | --------------- | ----- |
| `OnActivate → GetTrackedFlagPayload`                | cross_community | 7     |
| `OnActivate → GetTrackedFlagPayload`                | cross_community | 6     |
| `Constructor → GetTrackedFlagPayload`               | cross_community | 6     |
| `BuildByFrameRepeater → GetTrackedFlagPayload`      | cross_community | 6     |
| `Constructor → GetTrackedFlagPayload`               | cross_community | 6     |
| `HandleAiButtonClick → GetTrackedFlagPayload`       | intra_community | 6     |
| `App → GetTrackedFlagPayload`                       | cross_community | 6     |
| `LoadQueryModal → GetTrackedFlagPayload`            | cross_community | 5     |
| `OnActivate → GetTrackedFlagPayload`                | cross_community | 5     |
| `HandleMetricSelectedEvent → GetTrackedFlagPayload` | cross_community | 5     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Breakdown  | 1 calls     |
| Timeseries | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "reportExploreMetrics"})` — see callers and callees
2. `gitnexus_query({query: "quicksearch"})` — find related execution flows
3. Read key files listed above for implementation details
