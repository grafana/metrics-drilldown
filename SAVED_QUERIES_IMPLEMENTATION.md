# Saved Queries Feature Implementation

This document summarizes the implementation of the saved queries feature for Grafana Metrics Drilldown, based on the pattern from Logs Drilldown (PR #1702).

## Overview

The saved queries feature allows users to save and reload metric exploration states, including:
- Metric name
- Label filters (label matchers)
- Datasource configuration

**Storage Strategy:**
- **Primary:** Grafana Query Library (Grafana 12.4.0+ with `queryLibrary` feature flag)
- **Fallback:** Browser localStorage (for OSS users and older Grafana versions)

## Files Created

### Service Layer (3 files)

1. **`src/services/saveQuery.ts`**
   - Core CRUD operations for saved queries
   - Hooks: `useSavedQueries()`, `useHasSavedQueries()`, `useCheckForExistingQuery()`
   - LocalStorage management functions
   - Feature detection: `isQueryLibrarySupported()`
   - Data model: `SavedQuery` and `PrometheusQuery` interfaces

2. **`src/services/narrowSavedQueries.ts`**
   - Runtime type validation for saved queries
   - Type guards: `isSavedQuery()`, `narrowSavedQuery()`, `narrowSavedQueries()`
   - Ensures data integrity when reading from localStorage

3. **`src/services/parsePrometheusQuery.ts`**
   - Parses PromQL expressions to extract components
   - Extracts metric name and label matchers from query strings
   - Filters out special placeholders (`__ignore_usage__`, `${filters:raw}`)

4. **`src/services/variableGetters.ts`**
   - Helper functions for safely accessing scene variables
   - `getDataSourceVariable()` - Type-safe datasource variable access
   - `getDataSourceUid()` - Get datasource UID from scene

### UI Components (4 files)

1. **`src/Components/SavedQueries/SaveQueryButton.tsx`**
   - Functional component for save button
   - Switches between Query Library component and fallback modal
   - Extracts current state (metric, filters, datasource) from MetricScene
   - Builds PromQL expression using `buildQueryExpression()`

2. **`src/Components/SavedQueries/SaveQueryModal.tsx`**
   - Fallback modal for saving queries (localStorage mode)
   - Form with title (required) and description (optional)
   - Displays PromQL expression preview
   - Duplicate detection with warning
   - Analytics tracking on save

3. **`src/Components/SavedQueries/LoadQueryScene.tsx`**
   - Scene object for load functionality
   - Manages datasource state changes
   - Switches between Query Library component and fallback modal
   - Handles query selection and navigation via `MetricSelectedEvent`
   - Parses PromQL to reconstruct exploration state

4. **`src/Components/SavedQueries/LoadQueryModal.tsx`**
   - Fallback modal for loading queries (localStorage mode)
   - Two-panel layout: query list (left) + details (right)
   - Shows title, timestamp, description, and PromQL preview
   - Delete and select actions
   - Analytics tracking on load/delete

## Files Modified

### Integration Points (2 files)

1. **`src/MetricScene/MetricActionBar.tsx`**
   - Added `loadQueryScene` to `MetricActionBarState`
   - Constructor and activation handler to initialize `LoadQueryScene`
   - Renders `SaveQueryButton` and `LoadQueryScene.Component` in action bar

2. **`src/AppDataTrail/DataTrail.tsx`**
   - Added `loadQueryScene` to `DataTrailState`
   - Initialized `LoadQueryScene` in constructor
   - Renders `LoadQueryScene.Component` in header controls

### Configuration (3 files)

1. **`src/shared/user-preferences/pref-keys.ts`**
   - Added `SAVED_QUERIES: 'saved-queries'` to `PREF_KEYS`

2. **`src/shared/tracking/interactions.ts`**
   - Added 6 new analytics events:
     - `save_query_modal_opened`
     - `query_saved` (with metadata: has_description, label_matcher_count, storage_type)
     - `load_query_modal_opened` (with metadata: saved_query_count, storage_type)
     - `saved_query_loaded` (with metadata: label_matcher_count, storage_type)
     - `saved_query_deleted` (with metadata: storage_type)
     - `duplicate_query_warning_shown`

3. **`src/plugin.json`**
   - Added `"grafana/query-library-context/v1"` to `dependencies.extensions.exposedComponents` (components this app consumes)
   - Declares the app’s dependency on the Query Library so Grafana can inject it when available (Grafana 12.4+ with `queryLibrary` feature flag)

### Dependencies (1 file)

1. **`package.json`**
   - Added `uuid@^11.1.0` for generating unique identifiers
   - Note: `semver` was already present, so no changes needed

## Data Model

### SavedQuery Interface
```typescript
interface SavedQuery {
  uid: string;                    // UUID
  title: string;                  // User-provided name
  description: string;            // Optional description
  timestamp: number;              // Creation time
  dsUid: string;                  // Datasource UID
  metric: string;                 // Metric name
  labelMatchers: LabelMatcher[];  // Label filters [{key, operator, value}]
  resolution?: 'HIGH' | 'MEDIUM' | 'LOW';  // Optional
  groupByField?: string;          // Optional group-by label
}
```

### Storage Key
- `grafana-metricsdrilldown-app.savedQueries` (uses plugin ID prefix)

## Key Features

1. **Dual Storage Support**
   - Automatically detects Query Library availability
   - Falls back to localStorage for older Grafana versions
   - Seamless UX switching between modes

2. **Type Safety**
   - Runtime type validation for localStorage data
   - TypeScript interfaces for compile-time safety
   - Helper functions with proper type guards

3. **State Management**
   - Extracts full exploration state from MetricScene
   - Reconstructs state when loading saved query
   - Handles datasource switching correctly

4. **Analytics Tracking**
   - Comprehensive event tracking for all user actions
   - Metadata includes storage type for behavior analysis
   - Tracks duplicate warnings

5. **User Experience**
   - Duplicate detection prevents accidental overwrites
   - Displays formatted PromQL expressions
   - Timestamps for saved queries
   - Delete functionality with confirmation

## Integration Architecture

### Save Flow
1. User clicks Save button in MetricActionBar or uses Query Library
2. SaveQueryButton extracts current state from DataTrail/MetricScene
3. Builds PromQL expression using `buildQueryExpression()`
4. Opens SaveQueryModal (fallback) or Query Library modal
5. User enters title/description
6. Query saved to localStorage with UUID and timestamp
7. Analytics event fired

### Load Flow
1. User clicks Load button in DataTrail header or MetricActionBar
2. LoadQueryScene shows modal (fallback) or Query Library dropdown
3. User selects saved query from list
4. Parser extracts metric and label matchers from PromQL
5. Navigation triggered via `MetricSelectedEvent` with URL values
6. DataTrail reconstructs exploration state
7. Analytics event fired

## Testing Checklist

- [x] TypeScript compilation passes
- [ ] Save query from metric detail view
- [ ] Load query from landing page (metrics list)
- [ ] Load query from metric detail view
- [ ] Queries persist across browser sessions
- [ ] Datasource switching works correctly
- [ ] Duplicate warning appears when saving identical query
- [ ] Delete query removes from list
- [ ] Query Library integration (requires Grafana 12.4+)
- [ ] Fallback to localStorage on older Grafana
- [ ] Analytics events fire correctly

## Future Enhancements

Potential improvements (not implemented):
- Query sharing across users (requires backend)
- Query categories/tags
- Import/export functionality
- Query history/versioning
- Search/filter saved queries
- Query templates
