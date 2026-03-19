---
name: savedqueries
description: "Skill for the SavedQueries area of metrics-drilldown. 12 symbols across 3 files."
---

# SavedQueries

12 symbols | 3 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how findExistingQuery, useHasSavedQueries, useSavedQueries work
- Modifying savedqueries-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/shared/savedQueries/savedQuery.ts` | notifySavedQueryChanges, findExistingQuery, useHasSavedQueries, useSavedQueries, refresh (+3) |
| `src/shared/savedQueries/narrowSavedQuery.ts` | isString, narrowSavedQuery, narrowSavedQueries |
| `src/shared/savedQueries/SaveQueryModal.tsx` | SaveQueryModal |

## Entry Points

Start here when exploring this area:

- **`findExistingQuery`** (Function) — `src/shared/savedQueries/savedQuery.ts:25`
- **`useHasSavedQueries`** (Function) — `src/shared/savedQueries/savedQuery.ts:29`
- **`useSavedQueries`** (Function) — `src/shared/savedQueries/savedQuery.ts:34`
- **`refresh`** (Function) — `src/shared/savedQueries/savedQuery.ts:38`
- **`narrowSavedQuery`** (Function) — `src/shared/savedQueries/narrowSavedQuery.ts:4`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `findExistingQuery` | Function | `src/shared/savedQueries/savedQuery.ts` | 25 |
| `useHasSavedQueries` | Function | `src/shared/savedQueries/savedQuery.ts` | 29 |
| `useSavedQueries` | Function | `src/shared/savedQueries/savedQuery.ts` | 34 |
| `refresh` | Function | `src/shared/savedQueries/savedQuery.ts` | 38 |
| `narrowSavedQuery` | Function | `src/shared/savedQueries/narrowSavedQuery.ts` | 4 |
| `narrowSavedQueries` | Function | `src/shared/savedQueries/narrowSavedQuery.ts` | 32 |
| `SaveQueryModal` | Function | `src/shared/savedQueries/SaveQueryModal.tsx` | 19 |
| `notifySavedQueryChanges` | Function | `src/shared/savedQueries/savedQuery.ts` | 15 |
| `getLocallySavedQueries` | Function | `src/shared/savedQueries/savedQuery.ts` | 70 |
| `saveInLocalStorage` | Function | `src/shared/savedQueries/savedQuery.ts` | 92 |
| `removeFromLocalStorage` | Function | `src/shared/savedQueries/savedQuery.ts` | 107 |
| `isString` | Function | `src/shared/savedQueries/narrowSavedQuery.ts` | 2 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `LoadQueryModal → IsString` | cross_community | 7 |
| `SaveQueryModal → IsString` | intra_community | 7 |
| `LoadQueryModal → BuildStorageKey` | cross_community | 6 |
| `SaveQueryModal → BuildStorageKey` | cross_community | 6 |
| `SaveQueryModal → GetTrackedFlagPayload` | cross_community | 5 |
| `LoadQueryModal → NotifySavedQueryChanges` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| User-preferences | 2 calls |
| Bookmarks | 1 calls |
| QuickSearch | 1 calls |

## How to Explore

1. `gitnexus_context({name: "findExistingQuery"})` — see callers and callees
2. `gitnexus_query({query: "savedqueries"})` — find related execution flows
3. Read key files listed above for implementation details
