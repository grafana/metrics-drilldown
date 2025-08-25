# GroupByVariable → Horizontal Expanding GroupBySelector Migration Plan

## Overview
Transform the current `GroupByVariable` component from a fixed-width dropdown to a responsive horizontal radio button group with overflow dropdown, similar to the `GroupBySelector` in traces-drilldown.

## Current State Analysis

### GroupByVariable (Current)
- **Type**: `QueryVariable` class extending Grafana Scenes
- **UI**: Single dropdown with fixed width (`theme.spacing(16)`)
- **Data Source**: Prometheus label names query
- **Features**: Include all, default to all, analytics tracking
- **Location**: `src/Breakdown/GroupByVariable.tsx`

### GroupBySelector (Target Pattern)
- **Type**: React functional component
- **UI**: Dynamic radio buttons + overflow dropdown
- **Features**: Responsive width detection, text measurement, filtered options
- **Location**: `src/components/Explore/GroupBySelector.tsx`

## Architecture Analysis

### Key Insight: radioAttributes Pattern
The `GroupBySelector` doesn't use a hardcoded "popular" array. Instead:

1. **`radioAttributes` prop**: Passed from parent components, contains predefined lists of important attributes
2. **Dynamic filtering**: Component filters `radioAttributes` against available `options`
3. **Width-based selection**: Shows as many filtered candidates as fit horizontally

Example from traces-drilldown:
```typescript
// In shared.ts
export const radioAttributesResource = [
  'resource.service.name',
  'resource.service.namespace',
  // ... other resource attributes
];

export const radioAttributesSpan = [
  'name', 'kind', 'rootName', 'status'
  // ... other span attributes
];

// Usage in components
<GroupBySelector
  radioAttributes={scope === RESOURCE ? radioAttributesResource : radioAttributesSpan}
  // ... other props
/>
```

## Migration Specifications

### Phase 1: Component Architecture Migration

#### 1.1 Convert from Class to Functional Component
```typescript
// Current: Class-based QueryVariable
export class GroupByVariable extends QueryVariable

// Target: Functional component with hooks
export function GroupBySelector({
  options,
  radioAttributes,
  value,
  onChange,
  showAll,
  model
}: GroupBySelectorProps)
```

#### 1.2 Props Interface Definition
```typescript
interface GroupBySelectorProps {
  options: Array<SelectableValue<string>>;
  radioAttributes: string[];  // Predefined priority labels for radio buttons
  value?: string;
  onChange: (label: string, ignore?: boolean) => void;
  showAll?: boolean;
  model: LabelBreakdownScene; // Or equivalent scene type
  // Enhanced properties based on traces implementation:
  filters?: AdHocVariableFilter[]; // For context-aware filtering
  enableSearch?: boolean; // Enable dropdown search functionality
}
```

### Phase 2: Define Metrics Radio Attributes

#### 2.1 Create Shared Constants
```typescript
// In src/shared.ts
export const radioAttributesMetrics = [
  // Common Prometheus labels (ordered by priority)
  'job',
  'instance',
  'service',
  'cluster',
  'namespace',
  'pod',
  'container',
  'endpoint',
  'status_code',
  'method',
  'handler',
  'code'
];
```

### Phase 3: Responsive Layout Implementation

#### 3.1 Width Detection Setup
```typescript
// Add dependencies
import { useResizeObserver } from '@react-aria/utils';
import { measureText } from '@grafana/ui';

// State management
const [availableWidth, setAvailableWidth] = useState<number>(0);
const controlsContainer = useRef<HTMLDivElement>(null);

// Width monitoring
useResizeObserver({
  ref: controlsContainer,
  onResize: () => {
    const element = controlsContainer.current;
    if (element) {
      setAvailableWidth(element.clientWidth);
    }
  },
});
```

#### 3.2 Dynamic Option Calculation
```typescript
// Constants (proven values from traces implementation)
const additionalWidthPerItem = 40; // Matches traces-group.tsx
const widthOfOtherLabelsDropdown = 180; // Matches traces implementation

const radioOptions = useMemo(() => {
  let radioOptionsWidth = 0;
  return radioAttributes
    .filter((attr) => {
      // Only include attributes that exist in available options
      let checks = !!options.find((opt) => opt.value === attr);

      // Context-aware filtering based on current filters (from traces pattern)
      if (filters && filters.find((f) => f.key === attr && (f.operator === '=' || f.operator === '!='))) {
        return false;
      }

      // Add metrics-specific filtering logic here as needed
      // e.g., exclude certain labels based on current metric type

      return checks;
    })
    .map((attribute) => ({
      label: attribute,
      text: attribute,
      value: attribute,
    }))
    .filter((option) => {
      const text = option.label || option.text || '';
      const textWidth = measureText(text, fontSize).width;
      if (radioOptionsWidth + textWidth + additionalWidthPerItem + widthOfOtherLabelsDropdown < availableWidth) {
        radioOptionsWidth += textWidth + additionalWidthPerItem;
        return true;
      }
      return false;
    });
}, [radioAttributes, options, filters, fontSize, availableWidth]);
```

#### 3.3 Overflow Dropdown Options with Search
```typescript
// Add search state management
const [selectQuery, setSelectQuery] = useState<string>('');

const dropdownOptions = useMemo(() => {
  const baseOptions = options.filter(option =>
    !radioOptions.find(radioOption => radioOption.value === option.value)
  );

  // Apply search filtering (from traces pattern)
  return filteredOptions(baseOptions, selectQuery);
}, [options, radioOptions, selectQuery]);

// Search filtering function (from traces implementation)
const filteredOptions = (options: Array<SelectableValue<string>>, query: string) => {
  if (options.length === 0) {
    return [];
  }

  if (query.length === 0) {
    return options.slice(0, maxOptions); // Limit for performance
  }

  const queryLowerCase = query.toLowerCase();
  return options
    .filter((option) => {
      if (option.value && option.value.length > 0) {
        return option.value.toLowerCase().includes(queryLowerCase);
      }
      return false;
    })
    .slice(0, maxOptions);
};
```

### Phase 4: UI Component Structure

#### 4.1 Render Structure
```typescript
const showAllOption = showAll ? [{ label: 'All', value: ALL_VARIABLE_VALUE }] : [];

return (
  <Field label="Group by">
    <div ref={controlsContainer} className={styles.container}>
      {radioOptions.length > 0 && (
        <RadioButtonGroup
          options={[...showAllOption, ...radioOptions]}
          value={value}
          onChange={onChange}
        />
      )}
      <Select
        value={dropdownOptions.some(x => x.value === value) ? value : null}
        placeholder="Other labels"
        options={dropdownOptions}
        onChange={(selected) => onChange(selected?.value || ALL_VARIABLE_VALUE)}
        className={styles.select}
        isClearable
        onInputChange={(value: string, { action }: InputActionMeta) => {
          if (action === 'input-change') {
            setSelectQuery(value);
          }
        }}
        onCloseMenu={() => setSelectQuery('')}
        virtualized
      />
    </div>
  </Field>
);
```

#### 4.2 Styling Updates
```typescript
function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      flexWrap: 'nowrap', // Prevent wrapping
    }),
    select: css({
      maxWidth: theme.spacing(20),
      minWidth: theme.spacing(12),
    }),
  };
}
```

### Phase 5: Data Integration

#### 5.1 Options Processing
```typescript
// Convert QueryVariable options to SelectableValue format
const processedOptions = useMemo(() => {
  if (!model.state.options) return [];

  return model.state.options.map(option => ({
    label: option.text || option.value,
    value: option.value,
  }));
}, [model.state.options]);
```

#### 5.2 Analytics Integration
```typescript
const handleChange = useCallback((newValue: string, ignore?: boolean) => {
  // Preserve existing analytics with enhanced tracking
  if (newValue && newValue !== value) {
    reportExploreMetrics('groupby_label_changed', {
      label: String(newValue),
      selectionMethod: radioOptions.find(opt => opt.value === newValue) ? 'radio' : 'dropdown',
      availableWidth: availableWidth,
      radioOptionsCount: radioOptions.length,
      totalOptionsCount: options.length
    });
  }

  onChange(newValue, ignore);
}, [value, onChange, radioOptions, availableWidth, options.length]);
```

### Phase 6: Scene Integration

#### 6.1 Create Bridge Component
```typescript
// Create a bridge component for seamless integration
export function GroupByVariableRenderer({ variable }: { variable: GroupByVariable }) {
  const { options, value } = variable.useState();

  const processedOptions = useMemo(() =>
    options?.map(opt => ({
      label: opt.text || opt.value,
      value: opt.value
    })) || []
  , [options]);

  return (
    <GroupBySelector
      options={processedOptions}
      radioAttributes={radioAttributesMetrics}
      value={value as string}
      onChange={(newValue) => variable.changeValueTo(newValue)}
      showAll={true}
      model={getSceneContext(variable)}
    />
  );
}
```

#### 6.2 Replace Usage in Parent Components
```typescript
// Replace in parent scene components:
// <QueryVariable.Component model={groupByVariable} />

// With:
// <GroupByVariableRenderer variable={groupByVariable} />
```

## Implementation Steps

### Step 1: Dependencies & Setup ✅
1. Verify `RadioButtonGroup`, `measureText` are available in metrics-drilldown
2. Add `useResizeObserver` dependency or implement alternative
3. Create `radioAttributesMetrics` in shared constants

### Step 2: Core Component Development 🔨
1. Create new `GroupBySelector.tsx` component file
2. Implement responsive width detection logic
3. Build dynamic option filtering system
4. Create hybrid radio/dropdown UI

### Step 3: Bridge Component 🔨
1. Create `GroupByVariableRenderer` bridge component
2. Ensure seamless integration with existing QueryVariable
3. Preserve all existing functionality (analytics, state management)

### Step 4: Integration & Testing 🔨
1. Update parent components to use new renderer
2. Test responsive behavior across screen sizes
3. Validate analytics tracking continues to work
4. Ensure accessibility and usability

### Step 5: Migration & Cleanup 🔨
1. Replace all `GroupByVariable.Component` usages
2. Update tests and documentation
3. Performance testing and optimization

## File Structure

```
src/
├── Breakdown/
│   ├── GroupByVariable.tsx (existing - keep for data logic)
│   ├── GroupBySelector.tsx (new - UI component)
│   └── GroupByVariableRenderer.tsx (new - bridge component)
├── shared.ts (add radioAttributesMetrics)
└── utils/
    └── measurement.ts (if needed for text measurement)
```

## Configuration Options

### Customizable Constants
```typescript
const CONFIG = {
  additionalWidthPerItem: 40,        // Space around each radio button (from traces)
  dropdownMinWidth: 180,             // Minimum space for dropdown (from traces)
  maxRadioButtons: 6,                // Maximum radio buttons to show
  enableAllOption: true,             // Show "All" radio button
  maxOptions: 1000,                  // Maximum options in dropdown (performance)
};

// Priority order for radio buttons (metrics-specific)
const radioAttributesMetrics = [
  'job', 'instance', 'service',      // Highest priority
  'cluster', 'namespace', 'pod',     // Medium priority
  'container', 'endpoint',           // Lower priority
  'status_code', 'method', 'handler', 'code' // HTTP/API specific
];
```

## Benefits of Migration

1. **Improved UX**: Users can see and select common labels without opening dropdowns
2. **Better Space Utilization**: Automatically adapts to available screen width
3. **Faster Selection**: Popular labels accessible with single click
4. **Consistent UI**: Matches patterns from traces-drilldown for familiarity
5. **Performance**: Reduces dropdown interactions and improves workflow efficiency
6. **Responsive Design**: Works well across different screen sizes
7. **Enhanced Search**: Dropdown search functionality for quickly finding specific labels
8. **Context-Aware Filtering**: Smart filtering based on current filters and metric state

## Implementation Insights from Traces Analysis

### Key Patterns Adopted from traces-group.tsx

1. **Proven Constants**: Using `additionalWidthPerItem: 40` and `widthOfOtherLabelsDropdown: 180` which are battle-tested in traces.

2. **Context-Aware Filtering Logic**:
   ```typescript
   // Remove options that are already filtered
   if (filters && filters.find((f) => f.key === attr && (f.operator === '=' || f.operator === '!='))) {
     return false;
   }
   ```

3. **Search State Management**:
   - `selectQuery` state for dropdown filtering
   - `onInputChange` and `onCloseMenu` handlers
   - Performance-optimized with `maxOptions` limit

4. **Enhanced Analytics**: Track selection method, available width, and option counts for better insights.

5. **Robust Option Processing**:
   - Label text cleaning (remove prefixes/suffixes)
   - Virtualized dropdown for performance
   - Proper value handling with fallbacks

### Differences for Metrics Context

1. **Label Processing**: Metrics labels don't need the complex prefix/suffix removal that traces attributes have.

2. **Filter Integration**: Metrics use `AdHocVariableFilter` instead of traces-specific filter types.

3. **Priority Labels**: Metrics focus on Prometheus-standard labels (`job`, `instance`, `service`) rather than trace attributes.

## Risk Mitigation

### Potential Challenges & Solutions

1. **Dependency availability**:
   - Risk: `useResizeObserver` not available
   - Solution: Implement with native `ResizeObserver` API or container queries

2. **Text measurement**:
   - Risk: `measureText` unavailable
   - Solution: Use canvas-based measurement or CSS-based approximation

3. **Scene integration**:
   - Risk: Breaking existing QueryVariable functionality
   - Solution: Use bridge component pattern to preserve existing behavior

4. **Performance**:
   - Risk: Re-renders on resize
   - Solution: Use `useMemo`, `useCallback`, and debounced resize handlers

## Success Criteria

- [ ] Component adapts to available width automatically
- [ ] Common labels appear as radio buttons
- [ ] Overflow labels appear in dropdown
- [ ] Analytics tracking preserved
- [ ] No breaking changes to existing functionality
- [ ] Improved user selection speed for common labels
- [ ] Responsive behavior across screen sizes

## Timeline Estimate

- **Setup & Dependencies**: 1 day
- **Core Component Development**: 2-3 days
- **Bridge Component & Integration**: 1-2 days
- **Testing & Refinement**: 1-2 days
- **Documentation & Cleanup**: 1 day

**Total: 6-9 days**

---

*This migration will significantly enhance the user experience by providing immediate access to common grouping options while maintaining the full functionality of the dropdown for less common labels.*
