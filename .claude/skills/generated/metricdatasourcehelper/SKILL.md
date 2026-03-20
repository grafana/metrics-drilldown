---
name: metricdatasourcehelper
description: "Skill for the MetricDatasourceHelper area of metrics-drilldown. 22 symbols across 7 files."
---

# MetricDatasourceHelper

22 symbols | 7 files | Cohesion: 78%

## When to Use

- Working with code in `src/`
- Understanding how limitAdhocProviders, getClosestScopesFacade, ScopesFacade work
- Modifying metricdatasourcehelper-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | getRuntimeDatasource, getMetadataForMetric, fetchRecentMetrics, getTagKeys, getTagValues (+9) |
| `src/shared/utils/utils.trail.ts` | getQueries, limitAdhocProviders |
| `src/shared/utils/utils.scopes.ts` | getClosestScopesFacade, ScopesFacade |
| `src/AppDataTrail/header/PluginInfo/PluginInfo.tsx` | InfoMenu |
| `src/AppDataTrail/DataTrail.tsx` | DataTrail |
| `src/test/mocks/datasource.ts` | MockDataSourceSrv |
| `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.test.ts` | setup |

## Entry Points

Start here when exploring this area:

- **`limitAdhocProviders`** (Function) — `src/shared/utils/utils.trail.ts:78`
- **`getClosestScopesFacade`** (Function) — `src/shared/utils/utils.scopes.ts:7`
- **`ScopesFacade`** (Class) — `src/shared/utils/utils.scopes.ts:24`
- **`DataTrail`** (Class) — `src/AppDataTrail/DataTrail.tsx:96`
- **`MockDataSourceSrv`** (Class) — `src/test/mocks/datasource.ts:84`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ScopesFacade` | Class | `src/shared/utils/utils.scopes.ts` | 24 |
| `DataTrail` | Class | `src/AppDataTrail/DataTrail.tsx` | 96 |
| `MockDataSourceSrv` | Class | `src/test/mocks/datasource.ts` | 84 |
| `MetricDatasourceHelper` | Class | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 32 |
| `limitAdhocProviders` | Function | `src/shared/utils/utils.trail.ts` | 78 |
| `getClosestScopesFacade` | Function | `src/shared/utils/utils.scopes.ts` | 7 |
| `getRuntimeDatasource` | Method | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 44 |
| `getMetadataForMetric` | Method | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 82 |
| `fetchRecentMetrics` | Method | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 131 |
| `getTagKeys` | Method | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 161 |
| `getTagValues` | Method | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 176 |
| `getPrometheusBuildInfo` | Method | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 302 |
| `init` | Method | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 52 |
| `reset` | Method | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 57 |
| `fetchMetricsMetadata` | Method | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 110 |
| `getQueries` | Function | `src/shared/utils/utils.trail.ts` | 57 |
| `unwrapQuotes` | Function | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 364 |
| `isWrappedInQuotes` | Function | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 371 |
| `InfoMenu` | Function | `src/AppDataTrail/header/PluginInfo/PluginInfo.tsx` | 38 |
| `getQueryMetricsMetadata` | Function | `src/AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper.ts` | 376 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnActivate → IsPrometheusDataSource` | cross_community | 6 |
| `OnActivate → GetQueryMetricsMetadata` | cross_community | 5 |
| `OnActivate → GetLoadMetricsMetadata` | cross_community | 5 |
| `MetricFindQuery → IsPrometheusDataSource` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Breakdown | 1 calls |
| AppDataTrail | 1 calls |
| Labels | 1 calls |

## How to Explore

1. `gitnexus_context({name: "limitAdhocProviders"})` — see callers and callees
2. `gitnexus_query({query: "metricdatasourcehelper"})` — find related execution flows
3. Read key files listed above for implementation details
