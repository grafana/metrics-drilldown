---
name: metricsgroupbylist
description: "Skill for the MetricsGroupByList area of metrics-drilldown. 16 symbols across 9 files."
---

# MetricsGroupByList

16 symbols | 9 files | Cohesion: 82%

## When to Use

- Working with code in `src/`
- Understanding how onClickShowMore, onClickShowMore, onClickShowMore work
- Modifying metricsgroupbylist-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/MetricsReducer/MetricsGroupByList/MetricsGroupByRow.tsx` | MetricsGroupByRow, constructor, onClickShowMore, onActivate, subscribeToLayoutChange |
| `src/MetricsReducer/components/SceneByVariableRepeater.tsx` | SceneByVariableRepeater, increaseBatchSize |
| `src/MetricsReducer/MetricsList/MetricsList.tsx` | constructor, onClickShowMore |
| `src/MetricsReducer/MetricsGroupByList/MetricsGroupByList.tsx` | constructor, onClickShowMore |
| `src/shared/GmdVizPanel/GmdVizPanel.tsx` | GmdVizPanel |
| `src/MetricsReducer/labels/LabelValuesVariable.tsx` | LabelValuesVariable |
| `src/MetricsReducer/MetricsList/WithUsageDataPreviewPanel.tsx` | WithUsageDataPreviewPanel |
| `src/shared/GmdVizPanel/components/SelectAction.tsx` | SelectAction |
| `src/MetricScene/Breakdown/MetricLabelsList/MetricLabelsList.tsx` | onClickShowMore |

## Entry Points

Start here when exploring this area:

- **`onClickShowMore`** (Function) — `src/MetricsReducer/MetricsList/MetricsList.tsx:130`
- **`onClickShowMore`** (Function) — `src/MetricsReducer/MetricsGroupByList/MetricsGroupByRow.tsx:176`
- **`onClickShowMore`** (Function) — `src/MetricsReducer/MetricsGroupByList/MetricsGroupByList.tsx:100`
- **`onClickShowMore`** (Function) — `src/MetricScene/Breakdown/MetricLabelsList/MetricLabelsList.tsx:259`
- **`GmdVizPanel`** (Class) — `src/shared/GmdVizPanel/GmdVizPanel.tsx:99`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `GmdVizPanel` | Class | `src/shared/GmdVizPanel/GmdVizPanel.tsx` | 99 |
| `LabelValuesVariable` | Class | `src/MetricsReducer/labels/LabelValuesVariable.tsx` | 8 |
| `SceneByVariableRepeater` | Class | `src/MetricsReducer/components/SceneByVariableRepeater.tsx` | 45 |
| `WithUsageDataPreviewPanel` | Class | `src/MetricsReducer/MetricsList/WithUsageDataPreviewPanel.tsx` | 40 |
| `MetricsGroupByRow` | Class | `src/MetricsReducer/MetricsGroupByList/MetricsGroupByRow.tsx` | 46 |
| `SelectAction` | Class | `src/shared/GmdVizPanel/components/SelectAction.tsx` | 13 |
| `onClickShowMore` | Function | `src/MetricsReducer/MetricsList/MetricsList.tsx` | 130 |
| `onClickShowMore` | Function | `src/MetricsReducer/MetricsGroupByList/MetricsGroupByRow.tsx` | 176 |
| `onClickShowMore` | Function | `src/MetricsReducer/MetricsGroupByList/MetricsGroupByList.tsx` | 100 |
| `onClickShowMore` | Function | `src/MetricScene/Breakdown/MetricLabelsList/MetricLabelsList.tsx` | 259 |
| `constructor` | Method | `src/MetricsReducer/MetricsList/MetricsList.tsx` | 36 |
| `constructor` | Method | `src/MetricsReducer/MetricsGroupByList/MetricsGroupByRow.tsx` | 47 |
| `constructor` | Method | `src/MetricsReducer/MetricsGroupByList/MetricsGroupByList.tsx` | 29 |
| `increaseBatchSize` | Method | `src/MetricsReducer/components/SceneByVariableRepeater.tsx` | 150 |
| `onActivate` | Method | `src/MetricsReducer/MetricsGroupByList/MetricsGroupByRow.tsx` | 142 |
| `subscribeToLayoutChange` | Method | `src/MetricsReducer/MetricsGroupByList/MetricsGroupByRow.tsx` | 146 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Components | 2 calls |
| AppDataTrail | 1 calls |

## How to Explore

1. `gitnexus_context({name: "onClickShowMore"})` — see callers and callees
2. `gitnexus_query({query: "metricsgroupbylist"})` — find related execution flows
3. Read key files listed above for implementation details
