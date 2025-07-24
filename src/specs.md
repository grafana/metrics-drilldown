# Implementation Plan: DataSource Configuration Extensions for Metrics Drilldown

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

## 🚀 **Implementation Priority & Timeline**

### **Week 1-2: Foundation**
- ✅ **Phase 1**: Core DataSource Configuration Extensions
- ✅ Unit tests for basic functionality
- ✅ Integration with existing link infrastructure

### **Week 3: Enhancement**
- ✅ **Phase 2**: Status-aware extensions and health checking
- ✅ Enhanced error handling and user feedback
- ✅ Modal components for metrics preview

### **Week 4: Advanced Features**
- ✅ **Phase 3**: Datasource capability detection
- ✅ Smart default configuration
- ✅ Performance optimization

### **Week 5: Quality & Testing**
- ✅ **Phase 4**: Comprehensive testing suite
- ✅ E2E test coverage
- ✅ Documentation and examples

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

---

This plan provides a comprehensive implementation strategy that leverages the new Core Grafana extension points to significantly improve the discoverability and usability of the Metrics Drilldown plugin for Prometheus datasource users.
