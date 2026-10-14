# Exemplars to Traces Drilldown: implementation plan

## Goal

Let a user enable a Prometheus exemplars query on the main metric panel in Metrics Drilldown, then open a trace directly from an exemplar's tooltip in Traces Drilldown. The exemplar tooltip already links to Explore; this adds a second link alongside it.

Work spans three repos, all checked out at `/Users/brendanohandley/frontend-o11y/` on branch `bohandley/drilldown-exemplars-to-traces`:

- `metrics-drilldown`: add the toggle and wire the query
- `grafana`: add a link to the exemplar tooltip
- `traces-drilldown`: consume the link and build the URL

## Existing precedent for core-to-drilldown links

All three local drilldown apps (`logs-drilldown`, `metrics-drilldown`, `traces-drilldown`) already register `addedLinks` against extension points that `grafana/grafana` core defines and exposes, confirmed in each repo's `plugin.json`:

- `grafana/dashboard/panel/menu` (`DashboardPanelMenu`): all three register an "Open in [App] Drilldown" link here.
- `grafana/explore/toolbar/action` (`ExploreToolbarAction`): all three register here too.
- `grafana/datasources/config/actions` and `grafana/datasources/config/status`: metrics-drilldown registers "Open in Metrics Drilldown" here.

Core also already defines an extension point family shaped almost exactly for this feature: `grafana/logsview/resource-attributes` (`LogsViewResourceAttributes`) and `grafana/traceview/resource-attributes` (`TraceViewResourceAttributes`), both consumed through a shared context type in `packages/grafana-data/src/types/pluginExtensions.ts:351-363`:

```ts
export type PluginExtensionResourceAttributesContext = {
  // Key-value pairs of resource attributes, attribute name is the key
  attributes: Record<string, string[]>;
  spanAttributes?: Record<string, string[]>;
  timeRange: AbsoluteTimeRange;
  datasource: {
    type: string;
    uid: string;
  };
  traceID?: string;
  spanID?: string;
  spanStartTime?: number;
};
```

This type already carries `traceID`, `datasource`, and `timeRange`, exactly what a traces-drilldown link needs. `public/app/features/logs/components/useAttributesExtensionLinks.ts` shows the full consume-side pattern:

```ts
const context: PluginExtensionResourceAttributesContext = useMemo(() => {
  return {
    attributes: Object.fromEntries(Object.entries(row.labels).map(([key, value]) => [key, [value]])),
    timeRange: { from: timeRange.from.valueOf(), to: timeRange.to.valueOf() },
    datasource: {
      type: row.datasourceType ?? '',
      uid: row.datasourceUid ?? '',
    },
  };
}, [row.labels, row.datasourceType, row.datasourceUid, timeRange]);

const { links } = usePluginLinks({
  extensionPointId: PluginExtensionPoints.LogsViewResourceAttributes,
  limitPerPlugin: 10,
  context,
});
```

Caveat: as of this checkout, none of `logs-drilldown`, `metrics-drilldown`, or `traces-drilldown` registers a link into either `LogsViewResourceAttributes` or `TraceViewResourceAttributes`. The mechanism and the right-shaped context type both already exist in core, but nothing consumes them yet. The new exemplar extension point would be the first consumer of this pattern, not a copy of an already-working end-to-end example.

## Rejected alternative: zero-code datasource config

The Prometheus datasource already supports `exemplarTraceIdDestinations[].url` with Grafana's built-in link macros (`${__value.raw}`, `${__from}`, `${__to}`), which could point at a traces-drilldown URL with no code changes in any repo. This was considered and rejected: it requires every admin to hand-configure it per Prometheus datasource instance rather than working automatically once traces-drilldown is installed, which doesn't match how the existing drilldown integrations behave.

## Phase 1: metrics-drilldown

Add a checkbox to the main panel's header action row, alongside the existing `ConfigurePanelAction`, `AddToDashboardAction`, and similar actions (`src/shared/GmdVizPanel` header actions). Label: "Enable exemplar query."

1. **Feature flag.** Add a boolean entry to `goffFeatureFlags` in `src/shared/featureFlags/openFeature.ts:13-55`, following the `kgAnnotationsInMetricsDrilldown` pattern (lines 14-18). Add a typed async wrapper near lines 245-247, following `isSloTrackingEnabled`, for example `isExemplarsEnabled`. This flag gates rollout; it's separate from the checkbox's own on/off state.
2. **Checkbox state and default.** Off by default. The checkbox is scoped to the main panel only, not global, so its state needs to live on `MetricGraphScene` (where the panel is instantiated, `MetricGraphScene.tsx:73-108`) or a sibling object, not threaded generically through `QueryConfig`. `QueryConfig` and `buildFunctionQuery.ts` are shared by other call sites too (`MetricsList.tsx`'s grid view, `MetricLabelsList.tsx`, `MetricLabelValuesList.tsx`, `MetricsGroupByRow.tsx`, `ConfigurePanelForm.tsx`), which should not inherit this toggle.
3. **Wire the toggle to the query.** Add `exemplar: true` to the query object literals built in `buildFunctionQuery.ts:26-31` (custom-function path) and `:47-52` (`buildPresetFunctionQuery`), both invoked from `buildQueriesWithPresetFunctions` in `getTimeseriesQueryRunnerParams.ts:230-242`, gated on the checkbox state. Separately, the main panel's binary/ratio query branch in `getTimeseriesQueryRunnerParams.ts` (lines 46-52) builds its own query object directly and bypasses `buildFunctionQuery.ts` entirely; it needs the same field added if KG binary metrics should support exemplars too.
4. **No type changes needed.** `PromQuery` already supports `exemplar?: boolean` via the installed `@grafana/prometheus` schema (`dataquery.d.ts:16`).
5. **No `SceneQueryRunner` changes needed.** `SceneDataQuery` has an open index signature, and `prepareRequests` (`SceneQueryRunner.js:445`, mutation only at lines 468-474) passes extra fields through unmodified to the datasource.
6. **Query fan-out.** A panel configured with multiple preset functions (for example min/max/avg) produces multiple targets, and the datasource's own dedup (`shouldRunExemplarQuery` in `datasource.mjs:249-260`) only suppresses a duplicate exemplar fetch when the expression matches a metric name already cached as a histogram by an earlier target in the same request. For an ordinary counter or gauge, this dedup doesn't apply, so each target with `exemplar: true` triggers its own `/api/v1/query_exemplars` call. Decide whether to cap the field to one target per panel or accept the fan-out.
7. **Refetch cost.** Nothing currently suppresses a refetch of the exemplar query on unrelated panel refreshes (resize, unrelated filter changes). Scenes has a decoupled mechanism built for optional secondary queries, `ExtraQueryProvider` (`SceneQueryRunner.js:435-499`), unused anywhere in this app today. The existing KG annotations layer (`src/shared/knowledgeGraph/kgAnnotations.ts:173-176`) uses a simpler dedup guard instead, only re-querying when the relevant key actually changed. Either pattern is worth adopting rather than leaving the exemplar query to refire on every panel refresh.
8. **Verify exemplars return useful data for aggregated queries.** The main panel's default query is aggregated (`sum`/`avg`/`count` depending on metric type, `getTimeseriesQueryRunnerParams.ts:219-242`). Confirm Prometheus's exemplar side-channel returns meaningful results for an aggregated expression before shipping; if it doesn't, the checkbox needs to communicate that rather than silently showing nothing.
9. **No-op the checkbox for gauge metrics.** Per the OpenMetrics spec, exemplars are only defined for Counter, Histogram, and GaugeHistogram metric types; Gauge, Summary, StateSet, Info, and Unknown aren't covered, so a gauge metric is very unlikely to return any exemplars at all. This app already resolves the current metric's type before rendering the panel (`MetricType` union and `getMetricType`/`getMetricTypeSync`, `src/shared/GmdVizPanel/matchers/getMetricType.ts:10-18,25,61`). When the resolved type is `gauge`, hide or disable the checkbox instead of letting the user enable it and get an empty result with no explanation. This also narrows step 8: the aggregated-query question only applies to counter and histogram metrics, since gauges should no-op before reaching that code path.

## Phase 2: grafana/grafana

The exemplar tooltip is core code, not a datasource plugin. It's built from:

- `public/app/plugins/panel/timeseries/plugins/ExemplarMarker.tsx` (component `ExemplarMarker`, lines 33-206), instantiated per-exemplar by `ExemplarsPlugin.tsx:73-100`.
- `public/app/features/visualization/data-hover/ExemplarTooltip.tsx` (lines 18-39), which renders the links through `VizTooltipFooter`.

The existing "Explore" link is not a plugin extension. It comes from the generic Grafana data-link mechanism: `ExemplarMarker.tsx:136` collects `getFieldDisplayLinks(field, rowIndex)` across every field in the exemplar's `DataFrame`, and `field.getLinks()` resolves whatever `field.config.links` the producing datasource already attached. The exemplar `DataFrame` has no fixed field names; which field carries the trace-ID link is entirely determined by the datasource's `exemplarTraceIdDestinations` config.

Steps:

1. Add a new value to `PluginExtensionPoints` (`packages/grafana-data/src/types/pluginExtensions.ts`, near lines 213-247), named in the same family as the existing resource-attributes points, with a version suffix per the newer naming convention (for example `TimeSeriesExemplarAttributes = 'grafana/timeseries/exemplar-attributes/v1'`).
2. Reuse `PluginExtensionResourceAttributesContext` as the context type rather than inventing a new one; it already carries `traceID`, `datasource`, and `timeRange`.
3. In `ExemplarMarker.tsx`, call `usePluginLinks` unconditionally at the top level of the `ExemplarMarker` function component, alongside its other hooks (around lines 45-68). **Do not** call it inside `renderMarker` (lines 123-167): `renderMarker` is a `useCallback`-wrapped function invoked conditionally from JSX (`{(isOpen || isLocked) && <Portal>{renderMarker()}</Portal>}`, line 203), so a hook placed inside it would only run on some renders, violating the Rules of Hooks and crashing the tooltip the first time it's hovered.
4. Pass `limitPerPlugin` explicitly on the `usePluginLinks` call. Every existing call site does (`OpenInLogsDrilldownButton.tsx:18-22` passes `limitPerPlugin: 1`; `TracePageHeader.tsx:159-163` passes `limitPerPlugin: 2`); without it, multiple registered links at this extension point render uncapped.
5. Build the context's `traceID`/`datasource` fields from the same field the existing Explore link already resolves, since that's the one place in this code that already knows which field carries the trace link. Append the new link results to the array already passed into `ExemplarTooltip` (`ExemplarMarker.tsx:154`).
6. Check whether `VizTooltipFooter`'s `makeRenderLinksOrActions` collapses the link array to a single entry when any item sets `oneClick: true` (`VizTooltipFooter.tsx:69-82,126`). Confirm the existing Explore link or typical `exemplarTraceIdDestinations` configs don't set that flag, or the new link may never render even when everything else works.
7. Consider the per-marker cost: `ExemplarMarker` is instantiated once per visible exemplar point, not once per panel. Moving `usePluginLinks` to the component's top level means it runs once per rendered marker on every render, a different cost profile than existing call sites that run once per page-level component.

## Phase 3: traces-drilldown

`src/utils/links.ts`'s existing `contextToLink` (lines 52-124) can't be reused unchanged. It expects a full `PluginExtensionPanelContext` with `targets`/filters, not a resource-attributes context, and it has no `serviceName`/`traceId` parameter.

A direct-URL pattern already exists independent of any extension point: `TraceExploration` (`src/pages/Explore/TraceExploration.tsx:88-90`) registers `_urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['traceId', 'spanId'] })` against state fields at lines 75-77, and `getVariableSet` (lines 507-516) builds a `DataSourceVariable` named `VAR_DATASOURCE` that syncs itself to `var-ds` independently of `_urlSync`. So `/a/grafana-exploretraces-app/explore?traceId=<id>&spanId=<id>&var-ds=<datasourceUid>&from=<ts>&to=<ts>` opens a specific trace with no extension-point machinery required on the URL-building side.

Steps:

1. Add a fourth `addedLink` entry in `plugin.json` (pattern at lines 109-124), targeting the new extension point from Phase 2, with `title`/`description` matching the existing three entries.
2. Register it in `module.tsx` alongside the existing loop over `linkConfigs` (`module.tsx:7,40-42`).
3. Write a new `configure` function in `src/utils/links.ts`:
   - Build the base path with `createAppUrl()` (lines 126-128).
   - Set `var-ds` from `context.datasource.uid`, using the existing convention (`VAR_DATASOURCE = 'ds'`, `shared.ts:29`; pattern at `links.ts:68`).
   - Set `traceId` and `spanId` directly as query params, matching `TraceExploration`'s URL-sync keys, rather than `var-filters`, since this opens one specific trace, not a filtered trace list.
   - Set `from`/`to` via `toURLRange`, matching `links.ts:92-96`.
4. **Return `undefined`, not a malformed link, whenever the context is incomplete.** `configure` is synchronous (`PluginAddedLinksConfigureFunc` returns a plain object or `undefined`, not a `Promise`: `pluginExtensions.ts:105-113`), so it can't `await` a datasource lookup. Use the synchronous `getInstanceSettings(uid)` (`packages/grafana-runtime/src/services/dataSourceSrv.ts:34-37`) to confirm the UID resolves to an installed, Tempo-type datasource before returning a link. Also return `undefined` when `context.traceID` is missing or empty. The existing `contextToLink` already guards this way (`links.ts:57-60`); the new function needs the same discipline, because several real Prometheus configurations would otherwise produce a dead link:
   - External-URL-only `exemplarTraceIdDestinations` entries carry a trace ID but no `datasourceUid` at all.
   - Multiple destinations can map to the same label name (for example during a Jaeger-to-Tempo migration), so there's no single unambiguous `datasourceUid` to pick without an explicit rule.
   - A stale or uninstalled datasource UID should hide the link rather than produce one that 404s.
5. If the extension point ID isn't present in traces-drilldown's pinned `@grafana/data` version at implementation time, reference it as a raw string literal rather than an enum import, matching the existing precedent for `'grafana-assistant-app/navigateToDrilldown/v1'` (`links.ts:30,42`), and note that the link is inert on any Grafana core version older than the one shipping the new extension point.

## Open questions to resolve during implementation

- Whether to cap `exemplar: true` to one target per panel, or accept the multi-target fan-out described in Phase 1, step 6.
- Whether Prometheus's exemplar side-channel returns usable data for the main panel's default aggregated query, for counter and histogram metrics specifically (Phase 1, step 8). Gauge metrics are already ruled out by the OpenMetrics spec and should no-op per step 9, not reach this question at all.
- Exact mechanism for throttling/deduping the exemplar query on unrelated panel refreshes (Phase 1, step 7): `ExtraQueryProvider` versus a dedup guard modeled on `kgAnnotations.ts`.
- Whether `oneClick` behavior in `VizTooltipFooter` affects the new link's visibility (Phase 2, step 6); needs direct verification against a real exemplar frame.
- Mimir and Thanos exemplar support could not be verified from source available in this checkout (`@grafana/prometheus` source isn't vendored in either repo). Treat Mimir/Thanos behavior as unverified, not assumed working, until checked against those backends directly.
