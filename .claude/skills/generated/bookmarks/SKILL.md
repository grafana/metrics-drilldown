---
name: bookmarks
description: "Skill for the Bookmarks area of metrics-drilldown. 14 symbols across 11 files."
---

# Bookmarks

14 symbols | 11 files | Cohesion: 67%

## When to Use

- Working with code in `src/`
- Understanding how useBookmarks, genBookmarkKey, gotoBookmark work
- Modifying bookmarks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/shared/bookmarks/useBookmarks.ts` | useBookmarks, gotoBookmark |
| `src/shared/bookmarks/genBookmarkKey.ts` | filterUrlValues, genBookmarkKey |
| `src/shared/GmdVizPanel/components/BookmarkHeaderAction.tsx` | constructor, isCurrentStateBookmarked |
| `src/shared/user-preferences/userStorage.ts` | getItem |
| `src/shared/GmdVizPanel/components/ConfigurePanelAction.tsx` | constructor |
| `src/MetricScene/Breakdown/MetricLabelValuesList/SortBySelector.tsx` | constructor |
| `src/shared/shared.ts` | MetricSelectedEvent |
| `src/shared/savedQueries/LoadQueryModal.tsx` | SavedQueryItem |
| `src/MetricsReducer/helpers/registerRuntimeDataSources.ts` | registerRuntimeDataSources |
| `src/MetricsReducer/helpers/displayStatus.ts` | displayError |

## Entry Points

Start here when exploring this area:

- **`useBookmarks`** (Function) — `src/shared/bookmarks/useBookmarks.ts:20`
- **`genBookmarkKey`** (Function) — `src/shared/bookmarks/genBookmarkKey.ts:14`
- **`gotoBookmark`** (Function) — `src/shared/bookmarks/useBookmarks.ts:68`
- **`registerRuntimeDataSources`** (Function) — `src/MetricsReducer/helpers/registerRuntimeDataSources.ts:4`
- **`displayError`** (Function) — `src/MetricsReducer/helpers/displayStatus.ts:5`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `MetricSelectedEvent` | Class | `src/shared/shared.ts` | 25 |
| `useBookmarks` | Function | `src/shared/bookmarks/useBookmarks.ts` | 20 |
| `genBookmarkKey` | Function | `src/shared/bookmarks/genBookmarkKey.ts` | 14 |
| `gotoBookmark` | Function | `src/shared/bookmarks/useBookmarks.ts` | 68 |
| `registerRuntimeDataSources` | Function | `src/MetricsReducer/helpers/registerRuntimeDataSources.ts` | 4 |
| `displayError` | Function | `src/MetricsReducer/helpers/displayStatus.ts` | 5 |
| `onSelect` | Function | `src/MetricsReducer/SideBar/sections/BookmarksList/BookmarksList.tsx` | 45 |
| `constructor` | Method | `src/shared/GmdVizPanel/components/ConfigurePanelAction.tsx` | 19 |
| `constructor` | Method | `src/shared/GmdVizPanel/components/BookmarkHeaderAction.tsx` | 18 |
| `isCurrentStateBookmarked` | Method | `src/shared/GmdVizPanel/components/BookmarkHeaderAction.tsx` | 30 |
| `constructor` | Method | `src/MetricScene/Breakdown/MetricLabelValuesList/SortBySelector.tsx` | 43 |
| `filterUrlValues` | Function | `src/shared/bookmarks/genBookmarkKey.ts` | 2 |
| `SavedQueryItem` | Function | `src/shared/savedQueries/LoadQueryModal.tsx` | 171 |
| `getItem` | Method | `src/shared/user-preferences/userStorage.ts` | 13 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `LoadQueryModal → BuildStorageKey` | cross_community | 6 |
| `SaveQueryModal → BuildStorageKey` | cross_community | 6 |
| `HandleMetricSelectedEvent → BuildStorageKey` | cross_community | 5 |
| `OnActivate → BuildStorageKey` | cross_community | 5 |
| `Constructor → BuildStorageKey` | cross_community | 4 |
| `MetricFindQuery → DisplayError` | cross_community | 4 |
| `BuildByFrameRepeater → BuildStorageKey` | cross_community | 4 |
| `OnActivate → DisplayError` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| MetricLabelsList | 2 calls |
| User-preferences | 1 calls |
| QuickSearch | 1 calls |

## How to Explore

1. `gitnexus_context({name: "useBookmarks"})` — see callers and callees
2. `gitnexus_query({query: "bookmarks"})` — find related execution flows
3. Read key files listed above for implementation details
