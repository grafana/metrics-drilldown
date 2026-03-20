---
name: app
description: "Skill for the App area of metrics-drilldown. 24 symbols across 16 files."
---

# App

24 symbols | 16 files | Cohesion: 87%

## When to Use

- Working with code in `src/`
- Understanding how useReportAppInitialized, useCatchExceptions, App work
- Modifying app-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/App/useCatchExceptions.ts` | useCatchExceptions, isObjectWithStringProperty, ensureErrorObject, shouldTreatAsApplicationError, onError (+1) |
| `src/shared/utils/utils.timerange.ts` | toSceneTime, toSceneTimeRange |
| `src/App/InlineBanner.tsx` | formatErrorMessage, InlineBanner |
| `src/App/Trail.tsx` | getPageNav, Trail |
| `src/App/useReportAppInitialized.ts` | useReportAppInitialized |
| `src/App/App.tsx` | App |
| `src/shared/utils/utils.trail.ts` | newMetricsTrail |
| `src/exposedComponents/MiniBreakdown/MiniBreakdown.tsx` | MiniBreakdown |
| `src/exposedComponents/LabelBreakdown/LabelBreakdown.tsx` | LabelBreakdown |
| `src/exposedComponents/EntityMetrics/EntityMetrics.tsx` | EntityMetrics |

## Entry Points

Start here when exploring this area:

- **`useReportAppInitialized`** (Function) — `src/App/useReportAppInitialized.ts:4`
- **`useCatchExceptions`** (Function) — `src/App/useCatchExceptions.ts:67`
- **`App`** (Function) — `src/App/App.tsx:22`
- **`newMetricsTrail`** (Function) — `src/shared/utils/utils.trail.ts:37`
- **`toSceneTimeRange`** (Function) — `src/shared/utils/utils.timerange.ts:52`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `useReportAppInitialized` | Function | `src/App/useReportAppInitialized.ts` | 4 |
| `useCatchExceptions` | Function | `src/App/useCatchExceptions.ts` | 67 |
| `App` | Function | `src/App/App.tsx` | 22 |
| `newMetricsTrail` | Function | `src/shared/utils/utils.trail.ts` | 37 |
| `toSceneTimeRange` | Function | `src/shared/utils/utils.timerange.ts` | 52 |
| `ensureErrorObject` | Function | `src/App/useCatchExceptions.ts` | 16 |
| `onError` | Function | `src/App/useCatchExceptions.ts` | 73 |
| `onUnHandledRejection` | Function | `src/App/useCatchExceptions.ts` | 81 |
| `InlineBanner` | Function | `src/App/InlineBanner.tsx` | 29 |
| `getPageNav` | Function | `src/App/Trail.tsx` | 24 |
| `Trail` | Function | `src/App/Trail.tsx` | 63 |
| `useMetricsDrilldownQuestions` | Function | `src/App/assistant/useMetricsDrilldownQuestions.ts` | 14 |
| `AppRoutes` | Function | `src/App/Routes.tsx` | 15 |
| `useMetricsAppContext` | Function | `src/App/AppContext.tsx` | 15 |
| `ErrorView` | Function | `src/App/ErrorView.tsx` | 12 |
| `getActionViewName` | Method | `src/MetricScene/MetricScene.tsx` | 132 |
| `reload` | Method | `src/test/mocks/datasource.ts` | 144 |
| `toSceneTime` | Function | `src/shared/utils/utils.timerange.ts` | 21 |
| `MiniBreakdown` | Function | `src/exposedComponents/MiniBreakdown/MiniBreakdown.tsx` | 19 |
| `LabelBreakdown` | Function | `src/exposedComponents/LabelBreakdown/LabelBreakdown.tsx` | 19 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Trail → CountLogsLines` | cross_community | 6 |
| `App → GetTrackedFlagPayload` | cross_community | 6 |
| `Trail → RelatedLogsScene` | cross_community | 5 |
| `MiniBreakdown → GetTrackedFlagPayload` | cross_community | 5 |
| `LabelBreakdown → GetTrackedFlagPayload` | cross_community | 5 |
| `EntityMetrics → GetTrackedFlagPayload` | cross_community | 5 |
| `Trail → LabelBreakdownScene` | cross_community | 4 |
| `Trail → RelatedMetricsScene` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| QuickSearch | 4 calls |
| Extensions | 2 calls |
| MetricScene | 1 calls |
| MetricDatasourceHelper | 1 calls |

## How to Explore

1. `gitnexus_context({name: "useReportAppInitialized"})` — see callers and callees
2. `gitnexus_query({query: "app"})` — find related execution flows
3. Read key files listed above for implementation details
