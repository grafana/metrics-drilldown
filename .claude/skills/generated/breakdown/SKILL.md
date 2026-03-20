---
name: breakdown
description: "Skill for the Breakdown area of metrics-drilldown. 15 symbols across 9 files."
---

# Breakdown

15 symbols | 9 files | Cohesion: 65%

## When to Use

- Working with code in `src/`
- Understanding how isQueryVariable, getPanelTypeForMetric, getMetricType work
- Modifying breakdown-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/MetricScene/Breakdown/LabelBreakdownScene.tsx` | onActivate, getVariable, updateBody |
| `src/MetricScene/Breakdown/GroupByVariable.tsx` | GroupByOptionsLoadedEvent, onActivate, filterOptions |
| `src/AppDataTrail/DataTrail.tsx` | getMetadataForMetric, addFilterWithoutReportingInteraction |
| `src/shared/utils/utils.variables.ts` | isQueryVariable, isAdHocFiltersVariable |
| `src/shared/GmdVizPanel/matchers/getPanelTypeForMetric.ts` | getPanelTypeForMetric |
| `src/shared/GmdVizPanel/matchers/getMetricType.ts` | getMetricType |
| `src/MetricScene/Breakdown/MetricLabelsList/MetricLabelsList.tsx` | MetricLabelsList |
| `src/MetricScene/Breakdown/MetricLabelValuesList/MetricLabelValuesList.tsx` | MetricLabelValuesList |
| `src/AppDataTrail/DataTrail.test.tsx` | getFilterVar |

## Entry Points

Start here when exploring this area:

- **`isQueryVariable`** (Function) — `src/shared/utils/utils.variables.ts:20`
- **`getPanelTypeForMetric`** (Function) — `src/shared/GmdVizPanel/matchers/getPanelTypeForMetric.ts:9`
- **`getMetricType`** (Function) — `src/shared/GmdVizPanel/matchers/getMetricType.ts:22`
- **`isAdHocFiltersVariable`** (Function) — `src/shared/utils/utils.variables.ts:12`
- **`MetricLabelsList`** (Class) — `src/MetricScene/Breakdown/MetricLabelsList/MetricLabelsList.tsx:80`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `MetricLabelsList` | Class | `src/MetricScene/Breakdown/MetricLabelsList/MetricLabelsList.tsx` | 80 |
| `MetricLabelValuesList` | Class | `src/MetricScene/Breakdown/MetricLabelValuesList/MetricLabelValuesList.tsx` | 53 |
| `GroupByOptionsLoadedEvent` | Class | `src/MetricScene/Breakdown/GroupByVariable.tsx` | 19 |
| `isQueryVariable` | Function | `src/shared/utils/utils.variables.ts` | 20 |
| `getPanelTypeForMetric` | Function | `src/shared/GmdVizPanel/matchers/getPanelTypeForMetric.ts` | 9 |
| `getMetricType` | Function | `src/shared/GmdVizPanel/matchers/getMetricType.ts` | 22 |
| `isAdHocFiltersVariable` | Function | `src/shared/utils/utils.variables.ts` | 12 |
| `getMetadataForMetric` | Method | `src/AppDataTrail/DataTrail.tsx` | 353 |
| `onActivate` | Method | `src/MetricScene/Breakdown/LabelBreakdownScene.tsx` | 43 |
| `getVariable` | Method | `src/MetricScene/Breakdown/LabelBreakdownScene.tsx` | 61 |
| `updateBody` | Method | `src/MetricScene/Breakdown/LabelBreakdownScene.tsx` | 69 |
| `addFilterWithoutReportingInteraction` | Method | `src/AppDataTrail/DataTrail.tsx` | 342 |
| `onActivate` | Method | `src/MetricScene/Breakdown/GroupByVariable.tsx` | 39 |
| `filterOptions` | Method | `src/MetricScene/Breakdown/GroupByVariable.tsx` | 74 |
| `getFilterVar` | Function | `src/AppDataTrail/DataTrail.test.tsx` | 16 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnActivate → GetTrackedFlagPayload` | cross_community | 5 |
| `OnActivate → GetMetricTypeSync` | cross_community | 5 |
| `OnActivate → GetMetadataForMetric` | cross_community | 5 |
| `OnActivate → IsAdHocFiltersVariable` | cross_community | 4 |
| `MetricFindQuery → IsAdHocFiltersVariable` | cross_community | 4 |
| `OnActivate → GetMetricTypeSync` | cross_community | 4 |
| `OnActivate → GetMetadataForMetric` | cross_community | 4 |
| `OnActivate → GetMetricTypeSync` | cross_community | 4 |
| `OnActivate → GetMetadataForMetric` | intra_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Matchers | 1 calls |
| MetricLabelsList | 1 calls |
| RelatedMetrics | 1 calls |
| QuickSearch | 1 calls |

## How to Explore

1. `gitnexus_context({name: "isQueryVariable"})` — see callers and callees
2. `gitnexus_query({query: "breakdown"})` — find related execution flows
3. Read key files listed above for implementation details
