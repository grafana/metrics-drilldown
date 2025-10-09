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

- `/drilldown` - Exact match (metrics list view)
- `/drilldown?*metric=*` - Contains metric parameter (detail view)
- `/drilldown?*actionView=breakdown*` - Contains actionView=breakdown (breakdown tab)

## Question Guidelines

When writing questions:

- Start with "How do I..." for action-oriented questions
- Start with "What..." for explanatory questions
- Keep questions concise and user-friendly
- Focus on actual features that exist in the app
- Avoid technical jargon when possible

## Testing

To test questions:

1. Run the app locally
2. Navigate to the view you want to test
3. Open Grafana Assistant (check Grafana docs for how to enable)
4. Verify your questions appear
5. Verify questions disappear when navigating away

