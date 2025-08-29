## Traces Drilldown - GroupBySelector Component - Deep Dive Analysis

The `GroupBySelector` is a sophisticated component that provides an adaptive UI for selecting trace attributes to group by. It's used in both the **Breakdown** and **Comparison** scenes of the trace exploration interface.

### 🎯 Core Functionality

The component offers a **dual-interface approach**:
1. **Radio buttons** for frequently used attributes (when space allows)
2. **Dropdown select** for less common "other attributes"

### 🔄 Responsive Design Architecture

#### **1. Dynamic Width Calculation**
```typescript:40-48:src/components/Explore/GroupBySelector.tsx
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

The component uses `useResizeObserver` from React Aria to continuously monitor the container width, enabling real-time responsive adjustments.

#### **2. Smart Radio Button Visibility Algorithm**

The most sophisticated responsive feature is the **adaptive radio button display**:

```typescript:81-90:src/components/Explore/GroupBySelector.tsx
.filter((option) => {
  const text = option.label || option.text || '';
  const textWidth = measureText(text, fontSize).width;
  if (radioOptionsWidth + textWidth + additionalWidthPerItem + widthOfOtherAttributes < availableWidth) {
    radioOptionsWidth += textWidth + additionalWidthPerItem;
    return true;
  } else {
    return false;
  }
});
```

**How it works:**
- Uses Grafana's `measureText` utility to calculate exact text width based on current font size
- Adds `additionalWidthPerItem` (40px) for padding/margins per radio button
- Reserves `widthOfOtherAttributes` (180px) for the dropdown select
- Only shows radio buttons that fit within available space
- **Progressive degradation**: As space decreases, radio buttons are hidden and their options move to the dropdown

#### **3. Responsive Constants**
```typescript:21-22:src/components/Explore/GroupBySelector.tsx
const additionalWidthPerItem = 40;
const widthOfOtherAttributes = 180;
```

These constants ensure consistent spacing and reserve adequate space for the dropdown component.

### 🎨 UI/UX Design Patterns

#### **1. Hybrid Control Pattern**
The component implements a **progressive disclosure** pattern:
- **Primary options** (radio buttons): Immediately visible for quick access
- **Secondary options** (dropdown): Hidden but searchable for advanced use cases

#### **2. Context-Aware Filtering**
The component intelligently filters options based on current application state:

```typescript:53-75:src/components/Explore/GroupBySelector.tsx
.filter((op) => {
  // remove radio options that are in the dropdown
  let checks = !!options.find((o) => o.value === op);

  // remove radio options that are in the filters
  if (filters.find((f) => f.key === op && (f.operator === '=' || f.operator === '!='))) {
    return false;
  }

  // if filters (primary signal) has 'Full Traces' selected, then don't add rootName or rootServiceName to options
  if (filters.find((f) => f.key === 'nestedSetParent')) {
    checks = checks && op !== 'rootName' && op !== 'rootServiceName';
  }

  // if rate or error rate metric is selected, then don't add status to options
  if (metricValue === 'rate' || metricValue === 'errors') {
    checks = checks && op !== 'status';
  }

  return checks;
})
```

**Smart filtering prevents:**
- Duplicate options between radio buttons and dropdown
- Conflicting selections (e.g., filtering by an attribute that's already filtered)
- Invalid combinations (e.g., status grouping when rate metrics are selected)

#### **3. Enhanced Dropdown UX**
```typescript:135-152:src/components/Explore/GroupBySelector.tsx
<Select
  value={value && getModifiedSelectOptions(otherAttrOptions).some((x) => x.value === value) ? value : null}
  placeholder={'Other attributes'}
  options={getModifiedSelectOptions(otherAttrOptions)}
  onChange={(selected) => {
    const newSelected = selected?.value ?? defaultOnChangeValue;
    onChange(newSelected);
  }}
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
```

**Advanced features:**
- **Virtualization**: Handles large option lists (up to `maxOptions: 1000`) efficiently
- **Search functionality**: Real-time filtering with `onInputChange`
- **Clearable**: Users can deselect options
- **State synchronization**: Dropdown value clears when radio button is selected

### 📱 Responsive Breakpoint Behavior

#### **Large Screens (>1200px typically)**
- Most radio buttons visible
- Dropdown contains fewer "other" attributes
- Optimal user experience with immediate access to common options

#### **Medium Screens (768-1200px)**
- Moderate number of radio buttons shown
- More attributes moved to dropdown
- Still maintains good usability

#### **Small Screens (<768px)**
- Minimal or no radio buttons
- Most/all options in dropdown
- Graceful degradation maintains full functionality

### 🔧 Performance Optimizations

#### **1. Memoized Calculations**
```typescript:50-91:src/components/Explore/GroupBySelector.tsx
const radioOptions = useMemo(() => {
  // Expensive calculations only run when dependencies change
}, [radioAttributes, options, filters, metricValue, fontSize, availableWidth]);
```

#### **2. Efficient Text Measurement**
Uses Grafana's optimized `measureText` utility instead of DOM manipulation for width calculations.

#### **3. Virtualized Dropdown**
The `virtualized` prop ensures smooth scrolling even with 1000+ options.

### 🎯 Accessibility & UX Considerations

#### **1. Semantic Structure**
- Wrapped in `<Field label="Group by">` for proper labeling
- Radio buttons and dropdown are semantically distinct but functionally related

#### **2. Keyboard Navigation**
- Radio buttons support standard keyboard navigation
- Dropdown supports search-as-you-type

#### **3. Visual Hierarchy**
```typescript:158-167:src/components/Explore/GroupBySelector.tsx
container: css({
  display: 'flex',
  gap: theme.spacing(1),
}),
select: css({
  maxWidth: theme.spacing(22), // ~176px
}),
```

- Consistent spacing using theme values
- Limited dropdown width prevents layout issues
- Flexbox ensures proper alignment

### 🔄 State Management Integration

The component integrates deeply with the application's scene-based state management:
- Reads from multiple variables (filters, metrics, groupBy)
- Updates state through the parent scene's `onChange` handler
- Maintains local state for UI-specific concerns (search, auto-update)

This `GroupBySelector` represents a sophisticated example of responsive design in React, combining real-time width calculation, intelligent option filtering, progressive disclosure, and performance optimization to create a seamless user experience across all screen sizes.