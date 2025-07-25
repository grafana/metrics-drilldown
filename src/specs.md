# Implementation Plan: DataSource Configuration Extensions for Metrics Drilldown

**Status**: 🚧 **Phase 1 Complete** - Core DataSource Configuration Extensions implemented and tested
**Current State**: Users can now discover and access Metrics Drilldown directly from Prometheus datasource configuration pages

Based on the specs-core.md and analysis of the metrics-drilldown codebase, here's a comprehensive plan to implement the new DataSource Configuration extension points.

## 🎯 **Overview & Strategic Value**

The metrics-drilldown plugin (`grafana-metricsdrilldown-app`) is perfectly positioned to leverage these new extension points because:

1. **Already Whitelisted**: The plugin ID is already in the allowlist in Core Grafana
2. **Prometheus-Focused**: Plugin specifically targets Prometheus-compatible datasources
3. **Discovery Challenge**: Users often don't know about metrics drilldown capabilities when setting up datasources
4. **Context-Perfect**: Datasource configuration is the ideal place to discover metrics exploration tools

## 📋 **Implementation Plan**

### **Phase 1: Core DataSource Configuration Extensions** 🚀

#### **1.1 Create DataSource Extension Configuration File**
**Location**: `src/extensions/datasourceConfigLinks.ts`

**Purpose**: Add extension configurations for both new extension points:
- `PluginExtensionPoints.DataSourceConfigActions` - Action buttons
- `PluginExtensionPoints.DataSourceConfigStatus` - Status-aware links

**Key Features**:
```typescript
// New action button: "Explore Metrics" for Prometheus datasources
{
  title: 'Explore Metrics',
  description: 'Browse metrics without writing PromQL queries',
  targets: [PluginExtensionPoints.DataSourceConfigActions],
  icon: 'chart-line',
  configure: (context) => {
    // Only show for Prometheus-compatible datasources
    const prometheusTypes = ['prometheus', 'mimir', 'cortex', 'thanos'];
    return prometheusTypes.includes(context?.dataSource?.type) ? {} : undefined;
  },
  onClick: (_, { context }) => {
    // Navigate to metrics drilldown with datasource pre-selected
    const dsUid = context!.dataSource.uid;
    window.location.href = `/a/grafana-metricsdrilldown-app/drilldown?var-ds=${dsUid}`;
  },
}

// Status-aware help link for connection issues
{
  title: 'Metrics Connection Help',
  description: 'Troubleshoot metrics datasource connectivity',
  targets: [PluginExtensionPoints.DataSourceConfigStatus],
  icon: 'question-circle',
  configure: (context) => {
    // Only show for error status on Prometheus datasources
    const prometheusTypes = ['prometheus', 'mimir', 'cortex', 'thanos'];
    return (context?.severity === 'error' &&
            prometheusTypes.includes(context?.dataSource?.type)) ? {} : undefined;
  },
  path: '/docs/troubleshooting/prometheus-datasources', // Or could open modal
}
```

#### **1.2 Update Extensions Registration**
**File**: `src/module.tsx`

Add registration of the new datasource config extensions:

```typescript
import { linkConfigs } from 'extensions/links';
import { datasourceConfigLinkConfigs } from 'extensions/datasourceConfigLinks'; // NEW

// Register all extension types
for (const linkConfig of [...linkConfigs, ...datasourceConfigLinkConfigs]) {
  plugin.addLink(linkConfig);
}
```

#### **1.3 Enhanced URL Building**
**File**: `src/extensions/links.ts` (extend existing functionality)

Add datasource-specific URL building for cleaner integration:

```typescript
export function createDatasourceUrl(datasourceUid: string, route: string = ROUTES.Drilldown): string {
  const params = appendUrlParameters([
    [UrlParameters.DatasourceId, datasourceUid],
  ]);
  return createAppUrl(route, params);
}
```

### **Phase 2: Enhanced Status-Aware Extensions** 🔧

#### **2.1 Prometheus Health Check Integration**
**Purpose**: Provide intelligent diagnostics for Prometheus datasource issues

**Features**:
- **Connection Testing**: Quick metrics availability check
- **Common Fixes**: Links to documentation for common Prometheus issues
- **Version Detection**: Help identify Prometheus version compatibility issues

#### **2.2 Metric Discovery Preview**
**Purpose**: For successful datasource connections, show metrics preview

**Features**:
```typescript
{
  title: 'Preview Available Metrics',
  description: 'See a sample of available metrics from this datasource',
  targets: [PluginExtensionPoints.DataSourceConfigStatus],
  icon: 'eye',
  configure: (context) => {
    // Only show for successful Prometheus connections
    const prometheusTypes = ['prometheus', 'mimir', 'cortex', 'thanos'];
    return (context?.severity === 'success' &&
            prometheusTypes.includes(context?.dataSource?.type)) ? {} : undefined;
  },
  onClick: async (_, { context, openModal }) => {
    // Open modal with metrics preview
    openModal({
      title: 'Available Metrics Preview',
      body: ({ onDismiss }) => (
        <MetricsPreviewModal
          dataSourceUid={context!.dataSource.uid}
          onExplore={() => {
            window.location.href = createDatasourceUrl(context!.dataSource.uid);
            onDismiss!();
          }}
          onClose={onDismiss!}
        />
      ),
    });
  },
}
```

### **Phase 3: Advanced Integration Features** ⚡

#### **3.1 Datasource Capability Detection**
**Purpose**: Tailor metrics drilldown features based on datasource capabilities

**Implementation**:
```typescript
// Check datasource features and adjust messaging
function getDatasourceCapabilities(datasourceType: string) {
  const capabilities = {
    prometheus: ['native_histograms', 'exemplars', 'recording_rules'],
    mimir: ['native_histograms', 'exemplars', 'recording_rules', 'multi_tenancy'],
    cortex: ['exemplars', 'recording_rules'],
    thanos: ['exemplars', 'recording_rules', 'downsampling'],
  };
  return capabilities[datasourceType] || [];
}

// Adjust description based on capabilities
function getDescriptionForDatasource(datasourceType: string): string {
  const capabilities = getDatasourceCapabilities(datasourceType);

  let description = 'Browse metrics without writing PromQL queries';

  if (capabilities.includes('native_histograms')) {
    description += '. Includes native histogram support';
  }
  if (capabilities.includes('exemplars')) {
    description += '. View trace exemplars';
  }

  return description;
}
```

#### **3.2 Smart Default Configuration**
**Purpose**: Pre-configure metrics drilldown based on datasource setup

**Features**:
- **Auto-detect common metric patterns** (node_exporter, kube-state-metrics)
- **Set appropriate time ranges** based on datasource retention
- **Configure relevant label filters** based on discovered label names

### **Phase 4: Testing & Quality Assurance** 🧪

#### **4.1 Unit Tests**
**File**: `src/extensions/datasourceConfigLinks.test.ts`

```typescript
describe('DataSource Configuration Extensions', () => {
  describe('Explore Metrics Action', () => {
    it('should show for Prometheus datasources', () => {
      const context = {
        dataSource: { type: 'prometheus', uid: 'prom-1', name: 'Prometheus' }
      };
      const config = configureExploreMetricsAction(context);
      expect(config).toBeDefined();
    });

    it('should not show for non-Prometheus datasources', () => {
      const context = {
        dataSource: { type: 'influxdb', uid: 'influx-1', name: 'InfluxDB' }
      };
      const config = configureExploreMetricsAction(context);
      expect(config).toBeUndefined();
    });
  });

  describe('Status-Aware Extensions', () => {
    it('should show help link for Prometheus connection errors', () => {
      const context = {
        dataSource: { type: 'prometheus', uid: 'prom-1', name: 'Prometheus' },
        severity: 'error' as const,
        testingStatus: { message: 'Connection failed' }
      };
      const config = configureConnectionHelpLink(context);
      expect(config).toBeDefined();
    });
  });
});
```

#### **4.2 Integration Testing**
- **Test extension appearance** in datasource configuration
- **Verify URL construction** with different datasource UIDs
- **Test modal interactions** and navigation flows
- **Validate filtering logic** for different datasource types

#### **4.3 E2E Testing**
**File**: `e2e/tests/datasource-extensions.spec.ts`

```typescript
test('DataSource extensions appear in configuration', async ({ page }) => {
  // Navigate to Prometheus datasource configuration
  await page.goto('/datasources/edit/prometheus-uid');

  // Verify "Explore Metrics" button appears
  await expect(page.getByText('Explore Metrics')).toBeVisible();

  // Click and verify navigation to metrics drilldown
  await page.getByText('Explore Metrics').click();
  await expect(page.url()).toContain('/a/grafana-metricsdrilldown-app/drilldown');
  await expect(page.url()).toContain('var-ds=prometheus-uid');
});
```

## 📊 **File Structure & Implementation Details**

### **New Files to Create:**
```
src/extensions/
├── datasourceConfigLinks.ts          # Main extension configurations
├── datasourceConfigLinks.test.ts     # Unit tests
└── utils/
    ├── datasourceCapabilities.ts     # Datasource feature detection
    └── modalComponents/
        └── MetricsPreviewModal.tsx    # Preview modal component
```

### **Files to Modify:**
```
src/
├── module.tsx                        # Register new extensions
├── extensions/links.ts               # Add datasource URL helpers
└── constants.ts                      # Add any new constants
```

### **Testing Files:**
```
e2e/tests/
└── datasource-extensions.spec.ts    # E2E tests for new functionality
```

## 🎯 **Success Metrics**

### **User Experience Metrics:**
- **Discovery Rate**: Measure how many users access metrics drilldown from datasource config
- **Conversion Rate**: Users who explore metrics after datasource setup
- **Time to First Metrics**: Reduce time from datasource setup to metrics exploration

### **Technical Metrics:**
- **Extension Load Time**: Ensure extensions load quickly (<100ms)
- **Error Rates**: Monitor extension configuration and navigation errors
- **Compatibility**: Test across different Prometheus implementations

## 🚀 **Implementation Status & Timeline**

### **✅ COMPLETED: Phase 1 - Foundation** (Week 1)
- ✅ **Phase 1**: Core DataSource Configuration Extensions
  - ✅ Created `src/extensions/datasourceConfigLinks.ts` with "Explore Metrics" action
  - ✅ Implemented Prometheus-compatible datasource filtering (`prometheus`, `mimir`, `cortex`, `thanos`)
  - ✅ Added capability-aware descriptions (native histograms, exemplars)
  - ✅ Built `createDatasourceUrl()` helper for seamless navigation
  - ✅ Updated `src/module.tsx` to register new extensions
- ✅ Unit tests for basic functionality (27 tests with 100% coverage)
- ✅ Integration with existing link infrastructure

**Commit**: `3dc889a` - "feat: implement Phase 1 DataSource Configuration Extensions"

### **📋 PENDING: Phase 2 - Enhancement** (Week 2-3)
- ⏳ **Phase 2**: Status-aware extensions and health checking
- ⏳ Enhanced error handling and user feedback
- ⏳ Modal components for metrics preview

### **📋 PENDING: Phase 3 - Advanced Features** (Week 4)
- ⏳ **Phase 3**: Datasource capability detection
- ⏳ Smart default configuration
- ⏳ Performance optimization

### **📋 PENDING: Phase 4 - Quality & Testing** (Week 5)
- ⏳ **Phase 4**: Comprehensive testing suite
- ⏳ E2E test coverage
- ⏳ Documentation and examples

## 💡 **Key Design Decisions**

### **1. Datasource Type Filtering**
**Decision**: Support `['prometheus', 'mimir', 'cortex', 'thanos']`
**Rationale**: These are the primary Prometheus-compatible datasources that benefit from queryless metrics exploration

### **2. Extension Placement Strategy**
**Decision**: Use both Actions and Status extension points
**Rationale**:
- **Actions**: Primary discovery path for successful datasource setups
- **Status**: Contextual help for connection issues and success confirmations

### **3. Navigation vs. Modal Strategy**
**Decision**: Direct navigation for primary action, modals for preview/help
**Rationale**:
- Direct navigation provides seamless workflow for primary use case
- Modals preserve context for secondary actions like preview and troubleshooting

### **4. URL Construction**
**Decision**: Pre-configure datasource selection in metrics drilldown
**Rationale**: Reduces friction by automatically selecting the relevant datasource

## 📚 **Implementation Learnings & Insights**

### **🔍 Extension Point Discovery**
**Challenge**: The original specs referenced `PluginExtensionPoints.DataSourceConfigActions` and `PluginExtensionPoints.DataSourceConfigStatus`, but investigation revealed only `PluginExtensionPoints.DataSourceConfig` was available in the current Grafana version.

**Solution**: Adapted implementation to use the single `DataSourceConfig` extension point with dynamic configuration through the `configure` function.

**Learning**: Always verify available extension points in the target Grafana version before implementation.

### **⚡ Context Typing & Developer Experience**
**Challenge**: Extension configure functions receive loosely-typed context objects, leading to TypeScript errors and poor developer experience.

**Solution**: Created explicit TypeScript interfaces (`DataSourceConfigContext`) to properly type context objects and provide IntelliSense support.

**Learning**: Proper TypeScript interfaces are crucial for maintainable extension code, even when working with loosely-typed plugin APIs.

### **🔧 URL Construction Strategy Evolution**
**Original Plan**: Use `onClick` handlers for navigation as shown in specs examples.

**Implemented Approach**: Use `path` property with dynamic configuration through `configure` function for cleaner integration.

**Rationale**:
- Better alignment with existing codebase patterns
- Simpler testing (no event simulation needed)
- More declarative approach
- Follows Grafana's extension best practices

**Learning**: Study existing extension patterns in the codebase before implementing new ones.

### **📦 Bundle Size Optimization**
**Discovery**: The codebase has careful attention to module.tsx bundle size, evidenced by "CAUTION" comments about imports.

**Implementation**:
- Kept imports minimal in the new datasource config file
- Reused existing utility functions from `links.ts`
- Followed established import patterns

**Learning**: Plugin startup performance matters - every import in module.tsx affects initial load time.

### **🧪 Testing Strategy Adaptations**
**Original Specs**: Focused on testing the `configureExploreMetricsAction` function separately.

**Final Implementation**: Integrated configuration logic directly into the extension config array for better encapsulation.

**Adaptations Made**:
- Tested the actual extension configuration objects
- Added URL encoding tests for special characters
- Achieved 100% code coverage with 27 comprehensive tests
- Verified all edge cases (undefined contexts, non-Prometheus datasources, etc.)

**Learning**: Test the actual implementation rather than intermediate abstractions for better coverage.

### **🎯 Capability-Based UX Design**
**Success**: The capability detection system (`getDatasourceCapabilities`) provides foundation for sophisticated user experience differentiation.

**Examples**:
- Prometheus/Mimir users see "Includes native histogram support"
- All Prometheus-compatible users see "View trace exemplars"
- Clean extensibility for future datasource types

**Learning**: Building capability-aware UX from the start creates better user experiences and easier future enhancements.

### **🔗 Extension Registration Patterns**
**Discovery**: The module.tsx registration pattern using spread operator for combining extension arrays is clean and maintainable.

**Implementation**: `[...linkConfigs, ...datasourceConfigLinkConfigs]` maintains separation of concerns while keeping registration simple.

**Learning**: Follow established patterns for extension registration to maintain codebase consistency.

### **📊 Real-World Extension Context**
**Key Insight**: Extension contexts contain rich metadata about datasources, including type, uid, and name, enabling sophisticated filtering and customization.

**Practical Application**: Used this metadata for smart filtering and dynamic URL generation, creating seamless user workflows.

**Learning**: Extension contexts are powerful - explore their full capabilities for richer plugin integrations.

## 🔮 **Future Enhancements**

### **Smart Metrics Recommendations**
- Analyze datasource metrics to suggest relevant exploration starting points
- Pre-configure common dashboards based on detected metric patterns

### **Integration with Other Grafana Features**
- Connect with Alerting for metrics-based alert creation
- Integration with Dashboard creation workflow

### **Advanced Prometheus Features**
- Native histogram exploration directly from datasource config
- Recording rules discovery and exploration
- Exemplar-based trace jumping

## 🔄 **Next Steps**

### **Immediate (Phase 2)**
1. **Implement Status-Aware Extensions**: Add extensions that appear based on datasource health/connection status
2. **Create Metrics Preview Modal**: Allow users to preview available metrics before navigating
3. **Enhanced Error Handling**: Better UX for connection issues and troubleshooting

### **Medium-term (Phase 3-4)**
1. **E2E Testing**: Add comprehensive end-to-end tests for the extension functionality
2. **Smart Defaults**: Auto-detect and pre-configure common metric patterns
3. **Multi-tenancy Support**: Enhanced support for Mimir and other multi-tenant setups

### **Long-term**
1. **Analytics Integration**: Track discovery rates and user engagement metrics
2. **Cross-plugin Integration**: Connect with other Grafana plugins and features
3. **Advanced Capabilities**: Leverage future Grafana extension point enhancements

---

This plan provides a comprehensive implementation strategy that leverages Core Grafana extension points to significantly improve the discoverability and usability of the Metrics Drilldown plugin for Prometheus datasource users.

**✅ Phase 1 Complete**: Users now have seamless discovery of Metrics Drilldown capabilities directly from their datasource configuration experience.
