# Grafana Assistant Integration

This directory contains the integration with Grafana Assistant for Metrics Drilldown.

## Overview

The assistant questions system allows us to provide contextual help prompts that appear in Grafana Assistant based on the current page/view the user is on.

## Files

- `questions.ts` - All questions definitions organized by view
- `useMetricsDrilldownQuestions.ts` - Hook that registers questions with Grafana Assistant

## Adding Questions

When adding a new view or major feature:

1. Open `questions.ts`
2. Add a new exported array for your view (e.g., `export const myNewViewQuestions: Question[] = [...]`)
3. Add documentation comment explaining the URL pattern
4. Open `useMetricsDrilldownQuestions.ts`
5. Import your questions and register them with the appropriate URL pattern
6. Test by navigating to that view and opening Grafana Assistant

## URL Patterns

Questions are matched to URLs using wildcard patterns:

- `/a/grafana-metricsdrilldown-app/drilldown` - Exact match (metrics list view)
- `/a/grafana-metricsdrilldown-app/drilldown?*metric=*` - Contains metric parameter (detail view)
- `/a/grafana-metricsdrilldown-app/drilldown?*actionView=breakdown*` - Contains actionView=breakdown (breakdown tab)

## Question Guidelines

When writing questions:

- Start with "How do I..." for action-oriented questions
- Start with "What..." for explanatory questions
- Keep questions concise and user-friendly
- Focus on actual features that exist in the app
- Avoid technical jargon when possible

## Assistant Availability

The `useProvideQuestions` hook is safe to call regardless of whether Grafana Assistant is available. If the assistant is not installed or enabled, the hook simply does nothing. No availability checking is needed.

## Testing

To test questions:

1. Ensure Grafana Assistant is installed and enabled in your Grafana instance
2. Run the app locally (`npm run server` and `npm run dev`)
3. Navigate to Metrics Drilldown at `/a/grafana-metricsdrilldown-app/drilldown`
4. Open Grafana Assistant
5. Verify your questions appear based on the current view:
   - Metrics list view (`/a/grafana-metricsdrilldown-app/drilldown`) - shows metrics reducer questions
   - Metric detail view (`/a/grafana-metricsdrilldown-app/drilldown?metric=...`) - shows metric scene questions
   - Breakdown tab (`/a/grafana-metricsdrilldown-app/drilldown?metric=...&actionView=breakdown`) - shows breakdown questions
   - Related metrics tab (`/a/grafana-metricsdrilldown-app/drilldown?metric=...&actionView=related`) - shows related metrics questions
   - Related logs tab (`/a/grafana-metricsdrilldown-app/drilldown?metric=...&actionView=logs`) - shows related logs questions
6. Navigate between views and verify questions change appropriately

