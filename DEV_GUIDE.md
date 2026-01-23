# Developer Guide: Grafana Metrics Drilldown

A comprehensive guide for contributors to the Grafana Metrics Drilldown plugin - a queryless, exploration-focused interface for browsing Prometheus-compatible metrics built with Grafana's Scenes framework.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Development Environment](#development-environment)
- [Core Concepts](#core-concepts)
- [Component Architecture](#component-architecture)
- [State Management](#state-management)
- [Event-Driven Patterns](#event-driven-patterns)
- [Testing Strategy](#testing-strategy)
- [Contributing Guidelines](#contributing-guidelines)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- **Node.js**: 22+ required
- **Docker**: For local Grafana development server
- **Git**: For version control
- **pnpm**: 10.28.1+ required - Install via corepack (recommended) or see [pnpm installation guide](https://pnpm.io/installation) for other methods:
  ```bash
  corepack enable
  corepack prepare pnpm@10.28.1 --activate
  ```

### Initial Setup

```bash
# Clone and setup
git clone <repository-url>
cd metrics-drilldown
pnpm install

# Start development environment
pnpm run server     # Start Grafana server (http://localhost:3001)
pnpm run dev        # Build plugin in watch mode

# Run tests
pnpm run test       # Unit tests with coverage
pnpm run e2e        # End-to-end tests
```

### Development Commands

```bash
# Development
pnpm run dev        # Watch mode development
pnpm run server     # Docker-based Grafana server (port 3001)

# Testing
pnpm run test       # Jest unit tests with coverage
pnpm run tdd        # Tests in watch mode
pnpm run e2e        # Playwright end-to-end tests
pnpm run e2e:watch  # E2E tests with UI mode

# Code Quality
pnpm run lint       # Check for lint errors
pnpm run lint:fix   # Fix lint errors automatically
pnpm run typecheck  # Type checking without compilation

# Build
pnpm run build      # Production build
pnpm run analyze    # Bundle analysis
```

## Architecture Overview

The Grafana Metrics Drilldown plugin is a sophisticated **app plugin** that leverages Grafana's **Scenes framework** to provide a declarative, event-driven architecture for metrics exploration.

### Core Architecture Principles

1. **Declarative State Management**: Uses Scenes for declarative UI state with minimal imperative code
2. **Event-Driven Communication**: Components communicate via typed events rather than direct calls
3. **Variable-Based State**: Scene variables serve as single source of truth for all state
4. **Automatic Query Generation**: Intelligent query building based on metric type detection
5. **URL-Synchronized State**: Deep linking with automatic URL synchronization

### High-Level Component Hierarchy

```
DataTrail (Root State Container)
  Controls (Time picker, datasource, variables)
  TopScene (Dynamic content switcher)
      MetricsReducer (Main browsing interface)
      ListControls (Search, sorting, layout)
      SideBar (Filters, grouping, bookmarks)
      Body (SimpleMetricsList | MetricsGroupByList)
      Drawer (Function selection overlay)
      MetricScene (Individual metric visualization)
          MetricGraphScene (Main chart/graph)
          ActionTabs (Breakdown, Related, Logs)
```

### Technology Stack

- **Frontend**: React 18 + TypeScript 5.8
- **State Management**: Grafana Scenes 6.10+
- **Build System**: Webpack 5 + SWC for compilation
- **Testing**: Jest (unit) + Playwright (E2E)
- **Performance**: WASM integration via `@bsull/augurs`
- **Code Quality**: ESLint + Prettier + TypeScript strict mode

## Development Environment

### Local Development Setup

The plugin runs against a local Grafana instance via Docker:

1. **Grafana Server**: Runs on port 3001 (configurable via `GRAFANA_PORT` env var)
2. **Plugin Development**: Uses webpack dev server with hot reload
3. **Docker Compose**: Provides Grafana + Prometheus setup for testing

### Environment Configuration

Create `.env` file for custom configuration:

```bash
# Required for macOS/Windows local development
DOCKER_HOST_IP=host-gateway

# Optional: Custom ports
GRAFANA_PORT=3001
NODE_ENV=development
```

#### Docker Host Connectivity

- **macOS/Windows Local Development**: **REQUIRED** - Create a `.env` file with `DOCKER_HOST_IP=host-gateway`
- **Linux CI Environments**: Uses default `172.17.0.1` automatically (no configuration needed)
- This allows Grafana containers to connect to services running on the host machine (e.g., Prometheus/Loki running in other Docker networks)

### IDE Configuration

**VSCode Settings** (recommended):

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

## Core Concepts

### 1. Scenes Framework Integration

**Scene Objects**: Core building blocks that manage state and rendering

```typescript
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';

interface MySceneState extends SceneObjectState {
  myProperty: string;
}

class MyScene extends SceneObjectBase<MySceneState> {
  public static Component = ({ model }: SceneComponentProps<MyScene>) => {
    const { myProperty } = model.useState();
    return <div>{myProperty}</div>;
  };
}
```

**Scene Variables**: Reactive state containers with automatic dependency management

```typescript
import { SceneVariableSet, ConstantVariable } from '@grafana/scenes';

const variables = new SceneVariableSet({
  variables: [new ConstantVariable({ name: 'datasource', value: 'prometheus' })],
});
```

### 2. Event-Driven Architecture

**Event Definition**: Typed events for component communication

```typescript
interface EventFiltersChangedPayload {
  type: FilterType;
  filters: string[];
}

export class EventFiltersChanged extends BusEventWithPayload<EventFiltersChangedPayload> {
  static type = 'filters-changed';
}
```

**Event Publishing**: Components emit events for state changes

```typescript
// Publisher
this.publishEvent(
  new EventFiltersChanged({
    type: 'prefix',
    filters: selectedFilters,
  }),
  true
);

// Subscriber
this._subs.add(
  this.subscribeToEvent(EventFiltersChanged, (event) => {
    this.handleFiltersChanged(event.payload);
  })
);
```

### 3. Variable-Driven State Management

**Core Variables**:

- `MetricsVariable`: Master metrics list with lifecycle events
- `FilteredMetricsVariable`: Filtered/sorted subset using engines
- `AdHocFiltersVariable`: Dynamic label-based filters
- `LabelsVariable`: Group-by label selection

**Variable Dependencies**: Automatic updates when dependencies change

```typescript
const filteredMetrics = new FilteredMetricsVariable({
  name: 'filteredMetrics',
  datasource: datasourceVariable,
  $variables: new SceneVariableSet({ variables: [metricsVariable] }),
});
```

## Component Architecture

### Core Components

#### 1. DataTrail (`src/DataTrail.tsx`)

**Purpose**: Root state container and main coordinator
**Responsibilities**:

- Manages metric selection and navigation
- Handles URL synchronization and browser history
- Persists recent trails and bookmarks
- Coordinates between MetricsReducer and MetricScene

**Key Methods**:

```typescript
selectMetric(metric: string, options?: { skipUrlSync?: boolean })
showMetrics()
updateTimeRange(timeRange: TimeRange)
```

#### 2. MetricsReducer (`src/WingmanDataTrail/MetricsReducer.tsx`)

**Purpose**: Main metrics browsing interface
**Responsibilities**:

- Orchestrates filtering and sorting engines
- Manages centralized event handling
- Controls UI layout and component switching
- Handles variable lifecycle coordination

**Architecture Pattern**:

```typescript
class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  private _subs = new Subscription();
  private enginesMap = new Map<string, EngineContext>();

  public activate() {
    this.setupEventSubscriptions();
    this.registerEngines();
  }

  private setupEventSubscriptions() {
    this._subs.add(this.subscribeToEvent(EventFiltersChanged, this.handleFiltersChanged));
  }
}
```

#### 3. MetricScene (`src/MetricScene.tsx`)

**Purpose**: Individual metric visualization and exploration
**Responsibilities**:

- Auto-generates queries based on metric type
- Manages action tabs (Breakdown, Related Metrics, Logs)
- Handles drill-down interactions
- Provides metric-specific visualizations

### Variable Architecture

#### Engine Pattern

**Filter Engine** (`MetricsVariableFilterEngine`):

```typescript
class MetricsVariableFilterEngine {
  applyFilters(filters: FilterMap): void {
    this.currentFilters = { ...this.currentFilters, ...filters };
    this.updateVariable();
  }

  private updateVariable(): void {
    const filtered = this.originalMetrics.filter((metric) => this.passesAllFilters(metric));
    this.variable.setState({ metrics: filtered });
  }
}
```

**Sort Engine** (`MetricsVariableSortEngine`):

```typescript
class MetricsVariableSortEngine {
  sort(sortBy: SortBy): void {
    const metrics = [...this.variable.state.metrics];

    switch (sortBy) {
      case SortBy.Alphabetical:
        return this.alphabeticalSort(metrics);
      case SortBy.Usage:
        return this.usageBasedSort(metrics);
      case SortBy.WasmSort:
        return this.wasmSort(metrics);
    }
  }
}
```

## State Management

### Scene State Flow

1. **Initial Load**: DataTrail initializes with URL state or defaults
2. **Variable Setup**: Scene variables created with dependencies
3. **Engine Registration**: Filter/sort engines register with variables
4. **Event Flow**: User interactions trigger events  engines update  UI refreshes
5. **URL Sync**: State changes automatically sync to URL for deep linking

### State Persistence

**TrailStore** (`src/TrailStore/TrailStore.ts`):

- **Recent Trails**: localStorage with debounced saves (1 second)
- **Bookmarks**: User-created persistent references
- **URL Serialization**: Trail state serialized as URL parameters
- **Memory Management**: Weak references prevent memory leaks

```typescript
class TrailStore {
  private saveDebounced = debounce(() => {
    localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify(this.recent));
  }, 1000);

  addToRecent(trail: DataTrail): void {
    const urlState = trail.getSceneUrl();
    this.recent = this.deduplicateTrails([...this.recent, { urlState }]);
    this.saveDebounced();
  }
}
```

### URL State Management

**Automatic Synchronization**: Scene state automatically syncs with URL

```typescript
const dataTrail = new DataTrail({
  $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
  $variables: variableSet,
  $urlSync: new SceneObjectUrlSyncConfig(dataTrail, { updateSearchParams: true }),
});
```

## Event-Driven Patterns

### Event Categories

#### 1. Variable Lifecycle Events

```typescript
EventMetricsVariableActivated; // Variable becomes active
EventMetricsVariableDeactivated; // Variable becomes inactive
EventMetricsVariableLoaded; // Variable data loaded
```

#### 2. UI Interaction Events

```typescript
EventFiltersChanged; // Filter selection changes
EventSortByChanged; // Sort option changes
EventQuickSearchChanged; // Search input changes
EventSectionValueChanged; // Sidebar section changes
```

#### 3. Metric Selection Events

```typescript
MetricSelectedEvent; // Metric selected
RefreshMetricsEvent; // Metrics refresh requested
```

### Event Handling Patterns

**Centralized Event Handling** (MetricsReducer):

```typescript
private setupEventSubscriptions(): void {
  this._subs.add(
    this.subscribeToEvent(EventFiltersChanged, (event) => {
      const { type, filters } = event.payload;
      for (const [, { filterEngine, sortEngine }] of this.state.enginesMap) {
        filterEngine.applyFilters({ [type]: filters });
        sortEngine.sort(sortByVariable.state.value);
      }
      this.forceUpdate();
    })
  );
}
```

**Event Publishing** (Component level):

```typescript
const handleFilterChange = (filters: string[]) => {
  sceneRef.current?.publishEvent(
    new EventFiltersChanged({ type: 'prefix', filters }),
    true // bubble up
  );
};
```

## Testing Strategy

### Unit Testing (Jest)

**Configuration**: Uses SWC for fast compilation

```javascript
// jest.config.js
module.exports = {
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        /* config */
      },
    ],
  },
  transformIgnorePatterns: [nodeModulesToTransform(esModules)],
  collectCoverageFrom: ['./src/**'],
};
```

**Testing Patterns**:

```typescript
// Component testing with scene activation
describe('MetricsReducer', () => {
  let scene: MetricsReducer;

  beforeEach(() => {
    scene = new MetricsReducer({});
    scene.activate(); // Important: activate scene before testing
  });

  it('should handle filter events', () => {
    scene.publishEvent(
      new EventFiltersChanged({
        type: 'prefix',
        filters: ['test'],
      })
    );

    expect(scene.state.someProperty).toBe(expectedValue);
  });
});
```

**Mock Strategy**:

```typescript
// Comprehensive mocks for Grafana APIs
jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => mockDataSourceService,
  config: { theme2: mockTheme },
}));
```

### End-to-End Testing (Playwright)

**Architecture**: Page Object Model with reusable fixtures

```typescript
// e2e/fixtures/views/MetricsReducerView.ts
export class MetricsReducerView {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/a/grafana-metricsdrilldown-app/drilldown');
  }

  async assertCoreUI(): Promise<void> {
    await expect(this.page.getByTestId('sidebar')).toBeVisible();
    await expect(this.page.getByTestId('metrics-list')).toBeVisible();
  }
}
```

**Test Categories**:

- **Core UI Behavior**: Navigation, component visibility, interactions
- **Filtering & Sorting**: Sidebar filters, search functionality, sort options
- **Metric Selection**: Selection flow, visualization updates
- **Visual Regression**: Screenshot comparison for UI consistency

**Example Test**:

```typescript
// e2e/tests/metrics-reducer-view.spec.ts
test('should display filtered metrics correctly', async ({ metricsReducerView }) => {
  await metricsReducerView.goto();
  await metricsReducerView.selectFilter('prefixes', 'prometheus_');
  await metricsReducerView.assertFilteredResults('prometheus_');
});
```

## Contributing Guidelines

### Code Style

**TypeScript Configuration**:

- Strict mode enabled
- Target: ES2022
- Module: CommonJS (for Jest compatibility)

**ESLint Rules**:

```json
{
  "extends": ["@grafana/eslint-config"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "prefer-const": "error",
    "import/order": ["error", { "alphabetize": { "order": "asc" } }]
  }
}
```

### Development Workflow

1. **Branch Naming**: `feat/feature-name`, `fix/bug-description`, `chore/task-name`
2. **Commit Messages**: Follow conventional commits

   ```
   feat: add native histogram support
   fix: resolve memory leak in scene transitions
   chore: update dependencies
   ```

3. **Pull Request Process**:
   - Ensure all tests pass (`pnpm run test`, `pnpm run e2e`)
   - Run linting (`pnpm run lint:fix`)
   - Type checking passes (`pnpm run typecheck`)
   - Add appropriate tests for new functionality

### Code Patterns

**Component Structure**:

```typescript
interface MySceneState extends SceneObjectState {
  // State interface
}

export class MyScene extends SceneObjectBase<MySceneState> {
  // Constructor
  public constructor(state: Partial<MySceneState>) {
    super({ ...defaultState, ...state });
  }

  // Lifecycle methods
  public activate(): void {
    super.activate();
    // Setup subscriptions, initialize data
  }

  public deactivate(): void {
    // Cleanup subscriptions
    super.deactivate();
  }

  // Static component
  public static Component = ({ model }: SceneComponentProps<MyScene>) => {
    const state = model.useState();
    return <div>{/* JSX */}</div>;
  };
}
```

**Event Definition Pattern**:

```typescript
export interface EventPayload {
  property: string;
}

export class MyEvent extends BusEventWithPayload<EventPayload> {
  static type = 'my-event';
}
```

### Testing Requirements

**Unit Tests**: Required for all new components and utilities

- Test component behavior and state management
- Mock external dependencies
- Achieve >80% coverage for new code

**E2E Tests**: Required for new UI features

- Test complete user workflows
- Include screenshot testing for visual changes
- Test across different viewport sizes

### File Organization

```
src/
  ComponentName/              # Feature-based organization
    ComponentName.tsx         # Main component
    ComponentName.test.tsx    # Unit tests
    subcomponents/            # Related components
    utils.ts                  # Component-specific utilities
  utils/                      # Shared utilities
  types.ts                    # Shared type definitions
  constants.ts                # Application constants
```

## Performance Considerations

### WASM Integration

**Augurs Library**: Used for performance-critical operations

```typescript
// Lazy loading WASM module
const initializeWasm = async () => {
  try {
    const { OutlierDetector } = await import('@bsull/augurs');
    return new OutlierDetector();
  } catch (error) {
    console.warn('WASM not supported, falling back to JS implementation');
    return null;
  }
};
```

### Memory Management

**Scene Lifecycle**: Proper activation/deactivation prevents memory leaks

```typescript
public activate(): void {
  super.activate();
  this._subs.add(/* subscriptions */);
}

public deactivate(): void {
  this._subs.unsubscribe(); // Important: cleanup subscriptions
  super.deactivate();
}
```

**Debounced Operations**: Reduce unnecessary computations

```typescript
private updateFiltersDebounced = debounce(() => {
  this.applyFilters();
}, 300);
```

### Bundle Optimization

**Code Splitting**: Lazy load heavy components

```typescript
const MetricScene = React.lazy(() => import('./MetricScene'));
```

**Bundle Analysis**: Regular monitoring

```bash
pnpm run analyze  # Opens webpack-bundle-analyzer
```

## Troubleshooting

### Common Development Issues

#### 1. Scene State Not Updating

**Problem**: Changes to scene state don't trigger re-renders
**Solution**: Use `this.setState()` instead of direct state mutation

```typescript
// L Wrong
this.state.myProperty = newValue;

//  Correct
this.setState({ myProperty: newValue });
```

#### 2. Event Subscriptions Not Working

**Problem**: Events not received by subscribers
**Solution**: Ensure proper subscription lifecycle

```typescript
public activate(): void {
  super.activate();
  this._subs.add(
    this.subscribeToEvent(MyEvent, this.handleEvent.bind(this))
  );
}

public deactivate(): void {
  this._subs.unsubscribe(); // Critical for cleanup
  super.deactivate();
}
```

#### 3. URL Sync Issues

**Problem**: Scene state not syncing with URL
**Solution**: Verify SceneObjectUrlSyncConfig setup

```typescript
const scene = new MyScene({
  $urlSync: new SceneObjectUrlSyncConfig(scene, {
    updateSearchParams: true,
  }),
});
```

#### 4. Variable Dependencies Not Updating

**Problem**: Variable doesn't update when dependencies change
**Solution**: Check VariableDependencyConfig

```typescript
const variable = new MyVariable({
  $variables: dependencyVariableSet,
  variableDependency: new VariableDependencyConfig(variable, {
    statePaths: ['path.to.dependency'],
  }),
});
```

### Debugging Tools

**React DevTools**: Install browser extension for React debugging
**Scene Inspector**: Access via `window.__SCENES_DEBUG__` in console
**Network Panel**: Monitor data source queries and responses
**Performance Panel**: Profile rendering and state updates

### Build Issues

**TypeScript Errors**: Run `pnpm run typecheck` for detailed error messages
**SWC Compilation**: Clear Jest cache if tests fail: `pnpm exec jest --clearCache`
**Webpack Bundle**: Use `pnpm run analyze` to investigate bundle size issues

### Testing Issues

**Jest + ESM**: Ensure modules are listed in `transformIgnorePatterns`
**Playwright Failures**: Run `pnpm run e2e:watch` for interactive debugging
**Coverage Issues**: Check `collectCoverageFrom` patterns in jest.config.js

---

## Additional Resources

- **Grafana Plugin Development**: https://grafana.com/developers/plugin-tools/
- **Grafana Scenes Documentation**: https://grafana.com/developers/scenes/
- **React 18 Documentation**: https://react.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Playwright Testing**: https://playwright.dev/

---

This guide provides the foundation for contributing to the Grafana Metrics Drilldown plugin. The architecture emphasizes maintainability, performance, and developer experience through well-defined patterns and comprehensive testing strategies.
