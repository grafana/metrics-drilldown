---
name: fetchers
description: 'Skill for the Fetchers area of metrics-drilldown. 11 symbols across 3 files.'
---

# Fetchers

11 symbols | 3 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how extractMetricNames, fetchAlertingMetrics, fetchDashboardMetrics work
- Modifying fetchers-related functionality

## Key Files

| File                                                                               | Symbols                                                                                                                       |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchDashboardMetrics.ts` | processTargetsForMetrics, updateMetricUsage, fetchDashboardMetrics, checkDashboardLimitExceeded, getDashboardsWithPanels (+1) |
| `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchAlertingMetrics.ts`  | transformCountsToAlertingUsage, fetchAlertingMetrics, parseAlertingRules                                                      |
| `src/shared/utils/utils.promql.ts`                                                 | extractMetricNames, processIdentifier                                                                                         |

## Entry Points

Start here when exploring this area:

- **`extractMetricNames`** (Function) — `src/shared/utils/utils.promql.ts:21`
- **`fetchAlertingMetrics`** (Function) — `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchAlertingMetrics.ts:49`
- **`fetchDashboardMetrics`** (Function) — `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchDashboardMetrics.ts:78`

## Key Symbols

| Symbol                           | Type     | File                                                                               | Line |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------- | ---- |
| `extractMetricNames`             | Function | `src/shared/utils/utils.promql.ts`                                                 | 21   |
| `fetchAlertingMetrics`           | Function | `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchAlertingMetrics.ts`  | 49   |
| `fetchDashboardMetrics`          | Function | `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchDashboardMetrics.ts` | 78   |
| `processIdentifier`              | Function | `src/shared/utils/utils.promql.ts`                                                 | 45   |
| `processTargetsForMetrics`       | Function | `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchDashboardMetrics.ts` | 155  |
| `updateMetricUsage`              | Function | `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchDashboardMetrics.ts` | 172  |
| `transformCountsToAlertingUsage` | Function | `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchAlertingMetrics.ts`  | 34   |
| `parseAlertingRules`             | Function | `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchAlertingMetrics.ts`  | 69   |
| `checkDashboardLimitExceeded`    | Function | `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchDashboardMetrics.ts` | 110  |
| `getDashboardsWithPanels`        | Function | `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchDashboardMetrics.ts` | 141  |
| `parseDashboardSearchResponse`   | Function | `src/MetricsReducer/list-controls/MetricsSorter/fetchers/fetchDashboardMetrics.ts` | 193  |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Labels       | 1 calls     |
| AppDataTrail | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "extractMetricNames"})` — see callers and callees
2. `gitnexus_query({query: "fetchers"})` — find related execution flows
3. Read key files listed above for implementation details
