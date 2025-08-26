# 🎯 Comprehensive Plan: Adapting LabelBreakdownScene to Dual-Interface Responsive Approach

## Overview

This plan outlines the adaptation of the `LabelBreakdownScene` component to implement a dual-interface responsive approach, inspired by the Traces Drilldown `GroupBySelector` architecture. The goal is to provide an adaptive UI that uses radio buttons for frequently used labels and a dropdown for less common attributes, with intelligent responsive behavior.

## Phase 1: Architecture & Component Design

### 1.1 Create Enhanced GroupBySelector Component

Replace the current `GroupByVariable.Component` with a new `ResponsiveGroupBySelector` that implements the dual-interface pattern:

```typescript
// src/Breakdown/ResponsiveGroupBySelector/ResponsiveGroupBySelector.tsx
interface ResponsiveGroupBySelectorState extends SceneObjectState {
  availableWidth: number;
  commonLabels: string[];        // Frequently used labels for radio buttons
  allLabels: string[];          // All available labels
  selectedLabel: string | null;
  fontSize: number;
}

export class ResponsiveGroupBySelector extends SceneObjectBase<ResponsiveGroupBySelectorState>
```

### 1.2 Component Structure
```
src/Breakdown/ResponsiveGroupBySelector/
├── ResponsiveGroupBySelector.tsx     # Main component
├── hooks/
│   ├── useResizeObserver.ts         # Width monitoring
│   ├── useTextMeasurement.ts        # Text width calculation
│   └── useLabelFiltering.ts         # Smart label filtering logic
├── utils/
│   ├── labelPriority.ts             # Common vs uncommon labels
│   ├── widthCalculations.ts         # Radio button fitting algorithm
│   └── constants.ts                 # Responsive constants
└── types.ts                         # TypeScript interfaces
```

## Phase 2: Responsive Logic Implementation

### 2.1 Width Monitoring System
```typescript
// hooks/useResizeObserver.ts
export function useResizeObserver() {
  const [availableWidth, setAvailableWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const element = entries[0]?.target as HTMLElement;
      if (element) {
        setAvailableWidth(element.clientWidth);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return { containerRef, availableWidth };
}
```

### 2.2 Text Measurement Integration
```typescript
// hooks/useTextMeasurement.ts
import { measureText } from '@grafana/ui';

export function useTextMeasurement(fontSize: number) {
  return useCallback((text: string) => {
    return measureText(text, fontSize).width;
  }, [fontSize]);
}
```

### 2.3 Smart Radio Button Visibility Algorithm
```typescript
// utils/widthCalculations.ts
export const RESPONSIVE_CONSTANTS = {
  additionalWidthPerItem: 40,      // Padding/margins per radio button
  widthOfDropdown: 180,            // Reserved space for dropdown
  minContainerWidth: 300,          // Minimum width before hiding all radios
  radioButtonPadding: 16,          // Internal button padding
};

export function calculateVisibleRadioOptions(
  labels: string[],
  availableWidth: number,
  measureText: (text: string) => number
): { visibleLabels: string[], hiddenLabels: string[] } {
  let radioOptionsWidth = 0;
  const visibleLabels: string[] = [];
  const hiddenLabels: string[] = [];

  const { additionalWidthPerItem, widthOfDropdown } = RESPONSIVE_CONSTANTS;

  for (const label of labels) {
    const textWidth = measureText(label);
    const totalItemWidth = textWidth + additionalWidthPerItem;

    if (radioOptionsWidth + totalItemWidth + widthOfDropdown < availableWidth) {
      radioOptionsWidth += totalItemWidth;
      visibleLabels.push(label);
    } else {
      hiddenLabels.push(label);
    }
  }

  return { visibleLabels, hiddenLabels };
}
```

## Phase 3: Label Prioritization & Filtering

### 3.1 Common Labels Detection
```typescript
// utils/labelPriority.ts
export const COMMON_LABELS = [
  'instance', 'job', 'service', 'environment', 'region',
  'namespace', 'pod', 'container', 'node', 'cluster'
];

export function prioritizeLabels(allLabels: string[]): {
  commonLabels: string[];
  otherLabels: string[];
} {
  const commonLabels = COMMON_LABELS.filter(label => allLabels.includes(label));
  const otherLabels = allLabels.filter(label => !COMMON_LABELS.includes(label));

  return {
    commonLabels: [...commonLabels, ...otherLabels.slice(0, 5)], // Top 5 others
    otherLabels: otherLabels.slice(5)
  };
}
```

### 3.2 Context-Aware Filtering
```typescript
// hooks/useLabelFiltering.ts
export function useLabelFiltering(
  allLabels: string[],
  currentFilters: AdHocFilter[],
  selectedLabel: string | null
) {
  return useMemo(() => {
    return allLabels.filter(label => {
      // Remove already filtered labels
      if (currentFilters.some(f => f.key === label && (f.operator === '=' || f.operator === '!='))) {
        return false;
      }

      // Remove currently selected label from options
      if (label === selectedLabel) {
        return false;
      }

      return true;
    });
  }, [allLabels, currentFilters, selectedLabel]);
}
```

## Phase 4: Enhanced UI Components

### 4.1 Dual-Interface Component
```typescript
// ResponsiveGroupBySelector.tsx
public static readonly Component = ({ model }: SceneComponentProps<ResponsiveGroupBySelector>) => {
  const { availableWidth, selectedLabel } = model.useState();
  const styles = useStyles2(getStyles);
  const { containerRef } = useResizeObserver();
  const measureText = useTextMeasurement(14); // Base font size

  const groupByVariable = model.getGroupByVariable();
  const { options } = groupByVariable.useState();

  const filteredLabels = useLabelFiltering(options, currentFilters, selectedLabel);
  const { commonLabels, otherLabels } = prioritizeLabels(filteredLabels);
  const { visibleLabels, hiddenLabels } = calculateVisibleRadioOptions(
    commonLabels,
    availableWidth,
    measureText
  );

  return (
    <div ref={containerRef} className={styles.container}>
      {/* Radio Buttons for Common/Visible Labels */}
      {visibleLabels.length > 0 && (
        <RadioButtonGroup
          size="sm"
          options={visibleLabels.map(label => ({ label, value: label }))}
          value={selectedLabel}
          onChange={model.onRadioChange}
          className={styles.radioGroup}
        />
      )}

      {/* Dropdown for Other/Hidden Labels */}
      {(hiddenLabels.length > 0 || otherLabels.length > 0) && (
        <Select
          value={selectedLabel && ![...visibleLabels].includes(selectedLabel) ? selectedLabel : null}
          placeholder="Other labels"
          options={[...hiddenLabels, ...otherLabels].map(label => ({ label, value: label }))}
          onChange={model.onDropdownChange}
          className={styles.dropdown}
          isClearable
          virtualized
          maxMenuHeight={300}
        />
      )}

      {/* "All Labels" Option */}
      <Button
        variant={selectedLabel === null ? "primary" : "secondary"}
        size="sm"
        onClick={model.onSelectAll}
        className={styles.allButton}
      >
        All Labels
      </Button>
    </div>
  );
};
```

### 4.2 Enhanced Styling System
```typescript
// Responsive styles with breakpoints
function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      flexWrap: 'wrap',
      minHeight: theme.spacing(4),
    }),
    radioGroup: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexWrap: 'nowrap',

      // Responsive behavior
      [theme.breakpoints.down('md')]: {
        gap: theme.spacing(0.25),
      },
    }),
    dropdown: css({
      minWidth: theme.spacing(22),
      maxWidth: theme.spacing(30),

      [theme.breakpoints.down('sm')]: {
        minWidth: theme.spacing(16),
      },
    }),
    allButton: css({
      whiteSpace: 'nowrap',
    }),
  };
}
```

## Phase 5: Integration with LabelBreakdownScene

### 5.1 Update LabelBreakdownScene Component
```typescript
// LabelBreakdownScene.tsx - Updated Component
public static readonly Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
  const styles = useStyles2(getStyles);
  const { body } = model.useState();

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <Field label="Group by">
          <ResponsiveGroupBySelector.Component model={model.getResponsiveSelector()} />
        </Field>

        {/* Existing body controls */}
        {body instanceof MetricLabelsList && <body.Controls model={body} />}
        {body instanceof MetricLabelValuesList && <body.Controls model={body} />}
      </div>

      <div data-testid="panels-list">
        {body instanceof MetricLabelsList && <body.Component model={body} />}
        {body instanceof MetricLabelValuesList && <body.Component model={body} />}
      </div>
    </div>
  );
};
```

### 5.2 Enhanced Controls Layout
```typescript
// Updated styles for better responsive behavior
function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
      paddingTop: theme.spacing(1),
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      gap: theme.spacing(2),
      minHeight: '70px',
      padding: theme.spacing(1),
      alignItems: 'end',
      flexWrap: 'wrap',

      // Responsive stacking
      [theme.breakpoints.down('lg')]: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: theme.spacing(1),
        minHeight: 'auto',
      },
    }),
  };
}
```

## Phase 6: Performance Optimizations

### 6.1 Memoization Strategy
```typescript
// ResponsiveGroupBySelector.tsx
const visibleOptions = useMemo(() => {
  return calculateVisibleRadioOptions(commonLabels, availableWidth, measureText);
}, [commonLabels, availableWidth, measureText]);

const dropdownOptions = useMemo(() => {
  return [...visibleOptions.hiddenLabels, ...otherLabels].map(label => ({
    label,
    value: label,
  }));
}, [visibleOptions.hiddenLabels, otherLabels]);
```

### 6.2 Debounced Resize Handling
```typescript
// hooks/useResizeObserver.ts - Enhanced version
export function useResizeObserver(debounceMs = 100) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedSetWidth = useMemo(
    () => debounce((width: number) => setAvailableWidth(width), debounceMs),
    [debounceMs]
  );

  // ... rest of implementation
}
```

## Phase 7: Testing & Validation

### 7.1 Unit Tests
```typescript
// ResponsiveGroupBySelector.test.tsx
describe('ResponsiveGroupBySelector', () => {
  it('should show radio buttons when width is sufficient', () => {
    // Test radio button visibility logic
  });

  it('should move options to dropdown when width is constrained', () => {
    // Test responsive behavior
  });

  it('should filter out already selected labels', () => {
    // Test filtering logic
  });
});
```

### 7.2 E2E Tests
```typescript
// e2e/tests/responsive-breakdown.spec.ts
test('responsive breakdown selector adapts to screen size', async ({ page }) => {
  // Test responsive behavior across different viewport sizes
  await page.setViewportSize({ width: 1200, height: 800 });
  // Verify radio buttons are visible

  await page.setViewportSize({ width: 768, height: 600 });
  // Verify some options moved to dropdown

  await page.setViewportSize({ width: 480, height: 600 });
  // Verify most options are in dropdown
});
```

## Phase 8: Migration Strategy

### 8.1 Backward Compatibility
```typescript
// Gradual migration approach
export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  private useResponsiveSelector = config.featureToggles.responsiveBreakdownSelector ?? false;

  private getGroupBySelector() {
    return this.useResponsiveSelector
      ? this.getResponsiveSelector()
      : this.getLegacySelector();
  }
}
```

### 8.2 Feature Flag Integration
```typescript
// plugin.json - Add feature toggle
{
  "featureToggles": [
    {
      "name": "responsiveBreakdownSelector",
      "description": "Enable responsive dual-interface for breakdown selector",
      "stage": "alpha"
    }
  ]
}
```

## Phase 9: Documentation & Monitoring

### 9.1 Analytics Integration
```typescript
// Track usage patterns
const onRadioChange = (value: string) => {
  reportExploreMetrics('breakdown_radio_selected', {
    label: value,
    availableWidth,
    totalOptions: allLabels.length,
    visibleOptions: visibleLabels.length
  });
};

const onDropdownChange = (value: string) => {
  reportExploreMetrics('breakdown_dropdown_selected', {
    label: value,
    availableWidth,
    totalOptions: allLabels.length,
    hiddenOptions: hiddenLabels.length
  });
};
```

### 9.2 Performance Monitoring
```typescript
// Monitor responsive performance
useEffect(() => {
  const startTime = performance.now();

  // Calculation logic here

  const endTime = performance.now();
  if (endTime - startTime > 16) { // More than one frame
    console.warn('Responsive calculation took', endTime - startTime, 'ms');
  }
}, [availableWidth, allLabels]);
```

## Expected Benefits

1. **🎯 Improved UX**: Quick access to common labels via radio buttons
2. **📱 Better Responsiveness**: Graceful degradation across screen sizes
3. **⚡ Enhanced Performance**: Memoized calculations and debounced resize handling
4. **🔍 Better Discoverability**: Search functionality in dropdown for large label sets
5. **📊 Data-Driven**: Analytics to understand usage patterns and optimize further

## Implementation Timeline

- **Week 1-2**: Core responsive logic and text measurement utilities
- **Week 3**: ResponsiveGroupBySelector component implementation
- **Week 4**: Integration with LabelBreakdownScene and styling
- **Week 5**: Testing, performance optimization, and documentation
- **Week 6**: Feature flag rollout and monitoring setup

## Key Architectural Decisions

### Responsive Breakpoint Strategy
- **Large Screens (>1200px)**: Most radio buttons visible, minimal dropdown usage
- **Medium Screens (768-1200px)**: Moderate radio buttons, balanced dropdown usage
- **Small Screens (<768px)**: Minimal radio buttons, primary dropdown usage

### Label Prioritization Logic
1. **Common Infrastructure Labels**: `instance`, `job`, `service`, `environment`, etc.
2. **Context-Aware Filtering**: Remove already filtered labels and conflicting options
3. **Dynamic Prioritization**: Top 5 most frequent labels from current metric

### Performance Considerations
- Debounced resize handling (100ms default)
- Memoized text width calculations
- Virtualized dropdown for large option sets
- Progressive disclosure to minimize initial render cost

This plan transforms the current single-dropdown approach into a sophisticated dual-interface system that adapts intelligently to available space while maintaining all existing functionality and improving the user experience significantly.
