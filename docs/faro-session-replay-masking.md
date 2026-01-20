# Faro Session Replay Masking

## Overview

Session replay recordings mask potentially sensitive data like metric names, label names/values, and data source names using two complementary approaches:

1. **`data-sensitive` attribute** - For our own components
2. **CSS selectors** - For third-party components (Grafana Scenes panels)

## Approach

### For New Components

When creating components that display potentially sensitive data, add the `data-sensitive` attribute:

```tsx
// For metric names
<div data-sensitive>{metricName}</div>

// For label names/values
<span data-sensitive>{labelName}: {labelValue}</span>

// For containers with multiple sensitive items
<ul data-sensitive>
  {items.map(item => <li>{item.name}</li>)}
</ul>
```

### For Third-Party Components

Some components (like Grafana Scenes VizPanel) can't be modified directly. We target their CSS classes in the Faro configuration:

- `[class*="panel-title"]` - Masks panel titles rendered by Grafana Scenes

## What's Automatically Masked

**All input types** are masked by default:

- Text and search inputs
- Select dropdowns (data source picker, etc.)
- Textareas
- Password and email fields

## Notes

- **CSS selectors** use attribute matching `[class*="..."]` to handle Emotion's dynamic class names

## Configuration

See `src/shared/logger/faro/faro.ts` for the ReplayInstrumentation configuration.
