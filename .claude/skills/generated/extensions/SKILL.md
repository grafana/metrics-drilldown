---
name: extensions
description: "Skill for the Extensions area of metrics-drilldown. 17 symbols across 8 files."
---

# Extensions

17 symbols | 8 files | Cohesion: 85%

## When to Use

- Working with code in `src/`
- Understanding how configureDrilldownLink, buildDrilldownUrl, parsePromQLQuery work
- Modifying extensions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/extensions/links.ts` | configureDrilldownLink, buildDrilldownUrl, parsePromQLQuery, createPromURLObject, buildNavigateToMetricsParams (+4) |
| `src/exposedComponents/MiniBreakdown/buildNavigationUrl.ts` | buildMiniBreakdownNavigationUrl, navigateToMiniBreakdownUrl |
| `src/extensions/datasourceConfigLinks.ts` | createDatasourceUrl |
| `src/shared/utils/utils.promql.ts` | processLabelMatcher |
| `src/shared/savedQueries/LoadQueryModal.tsx` | LoadQueryModal |
| `src/exposedComponents/SourceMetrics/SourceMetrics.tsx` | getSourceMetricsScenario |
| `src/MetricScene/Breakdown/MetricLabelsList/MetricLabelsList.tsx` | buildLabelNavigationUrl |
| `src/extensions/parseMatcher.ts` | parseMatcher |

## Entry Points

Start here when exploring this area:

- **`configureDrilldownLink`** (Function) — `src/extensions/links.ts:82`
- **`buildDrilldownUrl`** (Function) — `src/extensions/links.ts:105`
- **`parsePromQLQuery`** (Function) — `src/extensions/links.ts:161`
- **`createPromURLObject`** (Function) — `src/extensions/links.ts:226`
- **`buildNavigateToMetricsParams`** (Function) — `src/extensions/links.ts:242`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `configureDrilldownLink` | Function | `src/extensions/links.ts` | 82 |
| `buildDrilldownUrl` | Function | `src/extensions/links.ts` | 105 |
| `parsePromQLQuery` | Function | `src/extensions/links.ts` | 161 |
| `createPromURLObject` | Function | `src/extensions/links.ts` | 226 |
| `buildNavigateToMetricsParams` | Function | `src/extensions/links.ts` | 242 |
| `createAppUrl` | Function | `src/extensions/links.ts` | 272 |
| `createDatasourceUrl` | Function | `src/extensions/datasourceConfigLinks.ts` | 7 |
| `processLabelMatcher` | Function | `src/shared/utils/utils.promql.ts` | 53 |
| `buildMiniBreakdownNavigationUrl` | Function | `src/exposedComponents/MiniBreakdown/buildNavigationUrl.ts` | 24 |
| `navigateToMiniBreakdownUrl` | Function | `src/exposedComponents/MiniBreakdown/buildNavigationUrl.ts` | 44 |
| `LoadQueryModal` | Function | `src/shared/savedQueries/LoadQueryModal.tsx` | 22 |
| `parseMatcher` | Function | `src/extensions/parseMatcher.ts` | 12 |
| `parseFiltersToLabelMatchers` | Function | `src/extensions/links.ts` | 257 |
| `escapeUrlPipeDelimiters` | Function | `src/extensions/links.ts` | 311 |
| `getSourceMetricsScenario` | Function | `src/exposedComponents/SourceMetrics/SourceMetrics.tsx` | 69 |
| `buildLabelNavigationUrl` | Function | `src/MetricScene/Breakdown/MetricLabelsList/MetricLabelsList.tsx` | 48 |
| `filterToUrlParameter` | Function | `src/extensions/links.ts` | 201 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `LoadQueryModal → IsString` | cross_community | 7 |
| `LoadQueryModal → BuildStorageKey` | cross_community | 6 |
| `LoadQueryModal → GetTrackedFlagPayload` | cross_community | 5 |
| `KnowledgeGraphSourceMetrics → ProcessLabelMatcher` | cross_community | 4 |
| `OnActivate → CreatePromURLObject` | cross_community | 3 |
| `OnActivate → BuildNavigateToMetricsParams` | cross_community | 3 |
| `OnActivate → CreateAppUrl` | cross_community | 3 |
| `LoadQueryModal → NotifySavedQueryChanges` | cross_community | 3 |
| `LoadQueryModal → ProcessLabelMatcher` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| MetricLabelsList | 1 calls |
| SavedQueries | 1 calls |
| QuickSearch | 1 calls |

## How to Explore

1. `gitnexus_context({name: "configureDrilldownLink"})` — see callers and callees
2. `gitnexus_query({query: "extensions"})` — find related execution flows
3. Read key files listed above for implementation details
