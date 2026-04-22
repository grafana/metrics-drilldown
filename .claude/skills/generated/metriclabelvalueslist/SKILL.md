---
name: metriclabelvalueslist
description: 'Skill for the MetricLabelValuesList area of metrics-drilldown. 28 symbols across 12 files.'
---

# MetricLabelValuesList

28 symbols | 12 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how publishTimeseriesData, resetYAxisSync, getLabelValueFromDataFrame work
- Modifying metriclabelvalueslist-related functionality

## Key Files

| File                                                                               | Symbols                                                                                                          |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/MetricScene/Breakdown/MetricLabelValuesList/SceneByFrameRepeater.tsx`         | SceneByFrameRepeater, constructor, performRepeat, initFilterAndSort, filter (+4)                                 |
| `src/MetricScene/Breakdown/MetricLabelValuesList/MetricLabelValuesList.tsx`        | buildByFrameRepeater, onClickShowMore, subscribeToQuickSearchChange, subscribeToSortByChange, onChangeState (+4) |
| `src/MetricScene/PanelMenu/PanelMenu.tsx`                                          | PanelMenu                                                                                                        |
| `src/MetricScene/Breakdown/MetricLabelsList/SelectLabelAction.tsx`                 | SelectLabelAction                                                                                                |
| `src/MetricScene/Breakdown/MetricLabelsList/MetricLabelsList.tsx`                  | getLabelPanelConfig                                                                                              |
| `src/MetricScene/Breakdown/MetricLabelValuesList/AddToFiltersGraphAction.tsx`      | AddToFiltersGraphAction                                                                                          |
| `src/MetricScene/Breakdown/MetricLabelsList/events/EventTimeseriesDataReceived.ts` | EventTimeseriesDataReceived                                                                                      |
| `src/MetricScene/Breakdown/MetricLabelsList/behaviors/publishTimeseriesData.ts`    | publishTimeseriesData                                                                                            |
| `src/MetricScene/Breakdown/MetricLabelsList/events/EventResetSyncYAxis.ts`         | EventResetSyncYAxis                                                                                              |
| `src/MetricScene/Breakdown/MetricLabelsList/behaviors/syncYAxis.ts`                | resetYAxisSync                                                                                                   |

## Entry Points

Start here when exploring this area:

- **`publishTimeseriesData`** (Function) — `src/MetricScene/Breakdown/MetricLabelsList/behaviors/publishTimeseriesData.ts:9`
- **`resetYAxisSync`** (Function) — `src/MetricScene/Breakdown/MetricLabelsList/behaviors/syncYAxis.ts:127`
- **`getLabelValueFromDataFrame`** (Function) — `src/MetricScene/Breakdown/MetricLabelValuesList/getLabelValueFromDataFrame.ts:2`
- **`onClickShowMore`** (Function) — `src/MetricScene/Breakdown/MetricLabelValuesList/MetricLabelValuesList.tsx:343`
- **`onChangeState`** (Function) — `src/MetricScene/Breakdown/MetricLabelValuesList/MetricLabelValuesList.tsx:148`

## Key Symbols

| Symbol                        | Type     | File                                                                               | Line |
| ----------------------------- | -------- | ---------------------------------------------------------------------------------- | ---- |
| `PanelMenu`                   | Class    | `src/MetricScene/PanelMenu/PanelMenu.tsx`                                          | 21   |
| `SelectLabelAction`           | Class    | `src/MetricScene/Breakdown/MetricLabelsList/SelectLabelAction.tsx`                 | 14   |
| `SceneByFrameRepeater`        | Class    | `src/MetricScene/Breakdown/MetricLabelValuesList/SceneByFrameRepeater.tsx`         | 50   |
| `AddToFiltersGraphAction`     | Class    | `src/MetricScene/Breakdown/MetricLabelValuesList/AddToFiltersGraphAction.tsx`      | 13   |
| `EventTimeseriesDataReceived` | Class    | `src/MetricScene/Breakdown/MetricLabelsList/events/EventTimeseriesDataReceived.ts` | 7    |
| `EventResetSyncYAxis`         | Class    | `src/MetricScene/Breakdown/MetricLabelsList/events/EventResetSyncYAxis.ts`         | 4    |
| `EventForceSyncYAxis`         | Class    | `src/MetricScene/Breakdown/MetricLabelsList/events/EventForceSyncYAxis.ts`         | 4    |
| `publishTimeseriesData`       | Function | `src/MetricScene/Breakdown/MetricLabelsList/behaviors/publishTimeseriesData.ts`    | 9    |
| `resetYAxisSync`              | Function | `src/MetricScene/Breakdown/MetricLabelsList/behaviors/syncYAxis.ts`                | 127  |
| `getLabelValueFromDataFrame`  | Function | `src/MetricScene/Breakdown/MetricLabelValuesList/getLabelValueFromDataFrame.ts`    | 2    |
| `onClickShowMore`             | Function | `src/MetricScene/Breakdown/MetricLabelValuesList/MetricLabelValuesList.tsx`        | 343  |
| `onChangeState`               | Function | `src/MetricScene/Breakdown/MetricLabelValuesList/MetricLabelValuesList.tsx`        | 148  |
| `buildByFrameRepeater`        | Method   | `src/MetricScene/Breakdown/MetricLabelValuesList/MetricLabelValuesList.tsx`        | 200  |
| `constructor`                 | Method   | `src/MetricScene/Breakdown/MetricLabelValuesList/SceneByFrameRepeater.tsx`         | 54   |
| `performRepeat`               | Method   | `src/MetricScene/Breakdown/MetricLabelValuesList/SceneByFrameRepeater.tsx`         | 115  |
| `initFilterAndSort`           | Method   | `src/MetricScene/Breakdown/MetricLabelValuesList/SceneByFrameRepeater.tsx`         | 165  |
| `filter`                      | Method   | `src/MetricScene/Breakdown/MetricLabelValuesList/SceneByFrameRepeater.tsx`         | 205  |
| `sort`                        | Method   | `src/MetricScene/Breakdown/MetricLabelValuesList/SceneByFrameRepeater.tsx`         | 215  |
| `filterAndSort`               | Method   | `src/MetricScene/Breakdown/MetricLabelValuesList/SceneByFrameRepeater.tsx`         | 170  |
| `increaseBatchSize`           | Method   | `src/MetricScene/Breakdown/MetricLabelValuesList/SceneByFrameRepeater.tsx`         | 225  |

## Execution Flows

| Flow                                           | Type            | Steps |
| ---------------------------------------------- | --------------- | ----- |
| `BuildByFrameRepeater → GetTrackedFlagPayload` | cross_community | 6     |
| `BuildByFrameRepeater → BuildStorageKey`       | cross_community | 4     |
| `BuildByFrameRepeater → FindTimeseriesPanels`  | cross_community | 4     |

## Connected Areas

| Area               | Connections |
| ------------------ | ----------- |
| MetricsGroupByList | 2 calls     |
| ConfigurePanelForm | 1 calls     |
| Behaviors          | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "publishTimeseriesData"})` — see callers and callees
2. `gitnexus_query({query: "metriclabelvalueslist"})` — find related execution flows
3. Read key files listed above for implementation details
