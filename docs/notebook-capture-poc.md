# Metrics Drilldown notebook capture POC

The main metric graph's action menu consumes `grafana/add-to-notebook-form/v1` when the host exposes it and the user has `notebooks:create` or `notebooks:write`. Metrics Drilldown owns the modal; the shared form owns notebook selection and writes. No consumer analytics events are added.

The capture reuses the Add to dashboard exporter. At picker open it snapshots interpolated PromQL (including filters), the resolved Prometheus datasource UID, visualization options and field configuration, and the raw time range. Relative date math stays relative; absolute instants become ISO strings. The effective timezone is captured, resolving browser timezone to its IANA name. Later navigation and edits do not change the pending capture.

## Scope and limitations

- Only the main metric graph gets this action, not metric-list or label/value rows.
- Direct-query main graphs, including percentile variants, are supported. Heatmaps, grouped charts, pre-fetched data and custom data providers/transformations are rejected with a warning rather than silently losing transforms.
- Unresolved datasources, mixed-datasource targets, empty queries and unresolved scene variables are rejected. Prometheus interval/range macros remain for the destination to evaluate.
- Uses only the v1 single-panel contract; no v2 ordered cells, default title or success callback.
- Unit tests mock the host's exposed form. They do not prove notebook persistence, backend authorization or hosted compatibility.

## Test plan

Automated regression tests cover missing/loading components, create/write versus read-only permissions, live menu availability, main-graph-only placement, picker open and both close routes, event routing, the real query-export payload, timezone/relative/absolute ranges, unsupported data providers, and snapshot stability across scene changes and repeated form builds.

Run:

```shell
pnpm exec jest --runInBand --forceExit src/shared/GmdVizPanel/components/addToNotebook/notebookCapture.test.ts src/AppDataTrail/DataTrail.notebook.test.tsx src/MetricScene/PanelMenu/__tests__/PanelMenu.test.tsx
pnpm typecheck
pnpm lint
pnpm i18n-extract-check
```

Manual follow-up on a Grafana build exposing the notebook form (not yet performed):

1. With notebooks disabled or without create/write permissions, confirm no notebook action appears. Confirm it appears for create-only and write-only users when notebooks are enabled.
2. Select a counter or gauge, a non-default Prometheus datasource, several label filters and a custom query function. Open **Add to notebook** from the main graph, then cancel using the form, close button, backdrop and Escape. Verify no write occurs.
3. Reopen, add to an existing notebook and create a new notebook. Inspect the resulting cell's queries, datasource UID, title, unit and legend against the source. Verify the chart renders equivalent data.
4. Repeat with relative date math and an absolute zoomed range in a non-UTC timezone; check the form's lock behavior and persisted cell range.
5. While the picker remains open, change the source metric, filters, datasource and time range through the source scene or navigation. Submit and confirm the original capture is written.
6. Attempt a heatmap capture; confirm a warning and no notebook write. Confirm label/value rows still offer only their existing actions.

No deployment or hosted verification is implied by this plan.

## Local validation

- Frozen dependency install succeeded with mise Node 24.21.0 and pnpm 11.28.5; no manifest or lockfile changes.
- `pnpm test:ci --forceExit`: 90 suites, 1,046 tests passed. Jest reported an open-worker/teardown warning; force exit was needed.
- `pnpm lint`: passed with 47 warnings and no errors.
- Prettier checks for all changed files, `pnpm i18n-extract-check`, and `git diff --check`: passed.
- `pnpm typecheck`: blocked by eight existing missing `__setWindowLocation` global references in `src/App/Trail.test.tsx`, `src/shared/logger/__tests__/getEnvironment.test.ts` and `src/shared/logger/faro/__tests__/faro.test.ts`. No errors were reported in changed files. These references also exist at HEAD.
- Production build, browser/E2E, actual notebook writes and hosted verification were not run. Next step is the manual host integration plan above after resolving the existing typecheck blocker separately.

## Changed files

- `src/AppDataTrail/DataTrail.tsx`: exposed form availability, permissions, event handling and host-owned modal.
- `src/MetricScene/PanelMenu/PanelMenu.tsx`: main-graph-only action and live availability updates.
- `src/MetricScene/PanelMenu/actions/AddToNotebookAction.ts`: capture on click, permission recheck and unsupported-chart warning.
- `src/shared/GmdVizPanel/components/addToNotebook/notebookCapture.ts`: local v1 contract and validated export snapshot.
- `src/shared/GmdVizPanel/components/addToNotebook/EventOpenAddToNotebook.ts`: scene event carrying the snapshot.
- `src/AppDataTrail/DataTrail.notebook.test.tsx`, `src/MetricScene/PanelMenu/__tests__/PanelMenu.test.tsx`, `src/shared/GmdVizPanel/components/addToNotebook/notebookCapture.test.ts`: focused behavioral regression coverage.
- `src/plugin.json`: exposed component dependency.
- `src/locales/en-US/grafana-metricsdrilldown-app.json`: extracted English action and warning strings.
- `docs/notebook-capture-poc.md`: scope, limitations, validation and manual follow-up plan.
