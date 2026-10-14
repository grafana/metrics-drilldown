# OTel-native cross-signal navigation: opportunities for Metrics Drilldown

## Context

This document traces back to epic grafana/metrics-drilldown#1284 [1], the product design doc "Enable cross-signal/app navigation (Product Design): Drilldown <-> O11y" [5], and the engineering bet document "Bet Document - OTel Native Support" [6]. Epic #1284 has three sub-issues: #1343 [2], #1344 [3], and #1345 [4].

## Sources

- [1] GitHub epic grafana/metrics-drilldown#1284, "Epic: OTel Support in Metrics Drilldown." Opened 2026-05-28. State: open. https://github.com/grafana/metrics-drilldown/issues/1284
- [2] GitHub issue grafana/metrics-drilldown#1343, "Feature: link to Traces drilldown with exemplars." Opened 2026-07-08. State: open. https://github.com/grafana/metrics-drilldown/issues/1343
- [3] GitHub issue grafana/metrics-drilldown#1344, "Feature/Spike: LInk to traces drilldown via shared labels." Opened 2026-07-08. State: open. https://github.com/grafana/metrics-drilldown/issues/1344
- [4] GitHub issue grafana/metrics-drilldown#1345, "Feature: Filter metrics by OTel metric prefix group categories." Opened 2026-07-08. State: open. https://github.com/grafana/metrics-drilldown/issues/1345
- [5] Product design doc, "Enable cross-signal/app navigation (Product Design): Drilldown <-> O11y." Owner: Nadine Vehling, Product Design, Drilldown. Last updated 2026-07-07. No public URL; the document text was provided directly for this investigation.
- [6] Engineering bet document, "Bet Document - OTel Native Support." Author: Joey Tawadrous. Created 2026-06-18. Status: Consensus Reached. No public URL; the document text was provided directly for this investigation.

## 1. Enable exemplars and link the exemplar tooltip to Traces Drilldown

**Capability:** Add a toggle that enables exemplar sampling on Prometheus panel queries in Metrics Drilldown's metrics reducer and metrics graph scenes. Update the exemplar tooltip to link to Traces Drilldown.

**Source:** Issue #1343 [2]: "We can add an option to enable exemplars in the panel query in Metrics Drilldown. Then, when the exemplar tooltip is shown, we can have a link to Traces Drilldown." Acceptance criteria, item 1 [2]: "Add a switch/toggle to enable exemplars in Metrics Drilldown panels. This can be in both metrics reducer and metrics graph scene." Acceptance criteria, item 2 [2]: "Update the exemplars tooltip to link to traces drilldown." Epic #1284 [1]: "We can improve exemplar querying in Prometheus by linking to Traces Drilldown which will have more OTel support than the current link to Traces in Explore." Bet document [6], Metrics Drilldown section: "Can add support for linking metrics to traces." The same section [6] also names an "Exemplars and logs model link approach."

**Current state in Metrics Drilldown:** `grep -rli "exemplar" src/` (TypeScript/TSX/JSON files only) returns no matches. No exemplar toggle, exemplar tooltip, or exemplar link exists in the repository. The closest existing mechanism is the logs-link pattern in `src/MetricScene/RelatedLogs/OpenInLogsDrilldownButton.tsx`, which the bet document's [6] suggested approach points to as the template to follow. The extension point it targets, at line 9:

  ```
  const extensionPointId = 'grafana-metricsdrilldown-app/open-in-logs-drilldown/v1';
  ```

  and its fallback/primary link construction, lines 38-44:

  ```
  href={
    logsDrilldownLinkExists
      ? `${config.appSubUrl}${logsDrilldownLink.path}`
      : `${config.appSubUrl}/a/grafana-lokiexplore-app`
  }
  ```

**Current state in Traces Drilldown:** No exemplar-specific code exists. The nearest working analog is a data-link rewrite mechanism in `src/pages/Explore/DataLinksCustomContext.tsx`, which intercepts Loki-bound data links generated on trace panels and rewrites their `href` into Logs Drilldown. It registers the extension function at lines 39-42:

  ```
  const extensions = usePluginFunctions<ContextForLinksFn>?.({
    extensionPointId: 'grafana-exploretraces-app/get-logs-drilldown-link/v1',
    limitPerPlugin: 1,
  });
  ```

  and applies the rewrite at lines 100-102:

  ```
  if (extensionLink?.path) {
    linkModel.href = locationUtil.assureBaseUrl(extensionLink.path);
  }
  ```

**Related issue:** #1343 [2].

## 2. Add a "related traces" tab to the metric scene, gated on shared-label/trace-ID detection

**Capability:** Add a tab to the metric scene, alongside the existing related-logs tab, that shows a visualization and a link to Traces Drilldown. Show the tab only when trace data exists for the current metric's labels.

**Source:** Issue #1344 [3]: "Metrics drilldown has a tab in the metric scene to show related logs. It does not have a tab to show related traces. We can identify trace data to show by shared labels. This precedent by related logs checks data sources and only shows if they are present." Acceptance criteria, items 2-3 [3]: "Check trace data sources for shared labels" and "Check for traces or trace id." Epic #1284 [1]: "Shared label/attribute names and values... acting as join keys between signals."

**Current state in Metrics Drilldown:** The related-logs precedent that #1344 [3] references exists. Tab registration, `src/MetricScene/MetricActionBar.tsx:58-67`:

  ```
  {
    displayName: t('action-bar.tab.related-logs', 'Related logs'),
    value: actionViews.relatedLogs,
    getScene: (metricScene: MetricScene) => metricScene.createRelatedLogsScene(),
    ...
    backgroundTask: (metricScene: MetricScene) => metricScene.relatedLogsOrchestrator.findAndCheckAllDatasources(),
  },
  ```

  Datasource existence gating, `src/MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts:101`: `const datasourcesToCheck = allLokiDatasources.slice(0, 5);`, with the comment at line 99: "Limit to first five datasources to avoid performance issues." The tab only counts a datasource in if it has rows, line 172: `if (rowCount > 0) {`. The empty-state component, `src/MetricScene/RelatedLogs/NoRelatedLogsFound.tsx:14-16`, reads: "We couldn't find any logs related to the current metric with your selected filters." No reference to Traces Drilldown or any other O11y app target exists anywhere in the metrics-drilldown repository (verified directly: `grep -rln "traces-drilldown\|TracesDrilldown\|grafana-exploretraces\|explore-traces\|exploretraces" src/` returns no matches).

**Current state in Traces Drilldown:** A search of `src/components`, `src/addedComponents`, `src/hooks`, and `src/pages` for a related-metrics tab or equivalent component found none.

**Related issue:** #1344 [3].

## 3. Filter metrics by OTel semantic-convention prefix categories

**Capability:** Let users filter the metrics list by OTel metric-prefix category, for example system (covering k8s, container, process), http, and database. The existing prefix filter operates on raw prefix strings.

**Source:** Issue #1345 [4]: "There are OTel prefix naming conventions. Metrics Drilldown already has a prefix filter. Our prefix does not have any connection to OTel semantic conventions. If we had this, we could allow users to search by OTel metric convention categories... like system (k8s, container, process, etc.), http, database and more." Acceptance criteria, item 1 [4]: "Choose most meaningful categories to group metrics by prefix (connect with Nadine/Cedric)." Epic #1284 [1]: "OTel metrics follow predictable namespace conventions (e.g. http.server.*, db.client.*, rpc.server.*)."

**Current state in Metrics Drilldown:** The prefix filter and prefix-grouping machinery that #1345 [4] proposes to extend already exist, with no semantic-convention logic. The filter type, `src/MetricsReducer/metrics-variables/MetricsVariableFilterEngine.ts:9`: `prefixes: string[];`. The matching regex it builds, `applyPrefixFilters`, lines 144 and 156:

  ```
  return `^${level0}[^a-z0-9]${level1}([^a-z0-9]|$)`;
  ...
  return `^${prefix}([^a-z0-9]|$)`;
  ```

  Prefix grouping, `src/MetricsReducer/metrics-variables/computeMetricPrefixGroups.ts:9`: `const parts = option.value.split(/[^a-z0-9]/i);` — splits on any non-alphanumeric character and groups by the first segment, with no OTel taxonomy applied. The filter's click-tracking event, `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx:354`: `reportExploreMetrics('sidebar_prefix_filter_applied', {`.

**Current state in Traces Drilldown:** Attribute grouping does not use semantic-convention categories anywhere in `src/components/Explore/AttributesSidebar.tsx`. Categorization is limited to the `ScopeType` defined at `src/types.ts:79`: `export type ScopeType = 'All' | 'Resource' | 'Span' | 'Favorites';`.

**Related issue:** #1345 [4].

## 4. Group OTel attribute/label values into named semantic categories with icons

**Capability:** Group attribute and label values shown to the user, for example in the Attribute Explorer, into named OTel categories such as Service, Kubernetes, Host, Container, Cloud, Process, Frontend, HTTP, Database, and Messaging, each with an associated icon.

**Source:** The product design doc [5] lists resource-attribute categories: "Service -> service.* ... Kubernetes -> k8s.* ... Host -> host.* ... Container -> container.* ... Cloud -> cloud, aws, gcp, azure ... Process -> process.* ... Frontend -> browser, device, session ... Telemetry SDK -> telemetry.*", and span-attribute categories "HTTP -> http.* ... Database -> db.* ... Messaging -> messaging.* ... RPC -> rpc.*." The document's design principle [5]: "Convention made visible: the attribute category names the OTel convention, users learn that conventions route to apps." The same document [5] cites AXA feedback: "service.namespace (OTel) or service.name is treated as a second-class citizen and used inconsistently across products."

**Current state in Metrics Drilldown:** A related building block exists, scoped to the Attribute Explorer sidebar, without the exact category names or icons the product design doc [5] lists. Domain groupings, `src/shared/otel/histogramAttributes.ts:14-77` (`HISTOGRAM_ATTRIBUTES_BY_DOMAIN`), are explicitly OTel-spec-sourced per the file's own header comment, lines 4-5: "Sourced from the OTel semantic-conventions spec (main branch, semconv v1.44.0, plus the separate semantic-conventions-genai repo for gen_ai.*)." It covers the domains http, rpc, database, messaging, jvm, v8js, faas, cicd, and genai (line 14 onward). Resource-attribute groupings, `src/shared/otel/resourceAttributes.ts:19-43` (`RESOURCE_ATTRIBUTES`), cover service, k8s, cloud, container, host, and telemetry.sdk attributes, ordered per the header comment, lines 9-11, against "the OTel spec's own service-identity requirements." Matching logic, `src/MetricScene/AttributeExplorer/PrometheusAttributeExplorer.tsx:143-183` (`getOtelPriorityAttributes`), and dotted-versus-underscore handling at lines 83-97. Matched attributes are surfaced through a badge function, lines 819-828:

  ```
  const getAttributeBadge = (attribute: string): string | undefined => {
    switch (attributeKinds?.[attribute]) {
      case 'metric':
        return t('attribute-explorer.badge-metric', 'OTel metric attribute');
      case 'resource':
        return t('attribute-explorer.badge-resource', 'OTel resource attribute');
  ```

  rendered at `src/MetricScene/AttributeExplorer/AttributeDistribution.tsx:551,581`. No per-category icon map exists in either file.

**Current state in Traces Drilldown:** No named-category attribute grouping exists in `src/components/Explore/AttributesSidebar.tsx`. Icon usage in that file is limited to a search icon at line 349 (`prefix={<Icon name="search" />}`) and a filter icon at line 443 (`{isFiltered && <Icon name="filter" color={theme.colors.text.disabled} />}`); no per-category icon map exists.

**Related issue:** Partial overlap with #1345 [4]. Issue #1345 groups metric name prefixes into OTel semantic-convention categories to filter the metrics list. Candidate 4 groups attribute and label values into OTel semantic-convention categories to display them in the Attribute Explorer, using a larger taxonomy and an icon per category; #1345 specifies neither.

## 5. "Open value in" multi-destination navigation menu for attribute values

**Capability:** When an attribute value identifies a resolvable entity, let the user open it in whichever O11y destination its OTel namespace maps to, for example service.* to App O11y, k8s.* to Kubernetes Monitoring, db.* to DB O11y, and session.id to Frontend O11y. Navigate directly when one destination applies. Show a menu when multiple destinations apply.

**Source:** The product design doc [5]: "Every span carries OTel resource attributes: service.name, k8s.cluster.name, db.name. These are entity references. The convention namespace deterministically decides where a value can be explored: service.* -> Entity Catalog, App O11y; k8s.* -> Entity Catalog (K8s), Kubernetes Monitoring; db.* -> DB O11y; session.id -> Frontend O11y." The same document [5]: "Single vs multiple destinations: one O11y destination navigates directly; multiple destinations open an 'open value in' menu." The bet document [6], All Drilldowns section: "Provide links between plugins for these attributes. Connect the places that make sense and let the user choose where they want to go when one attribute can link to multiple places."

**Current state in Metrics Drilldown:** The only existing outbound cross-app link is a single, fixed destination with no category routing. `src/MetricScene/RelatedLogs/OpenInLogsDrilldownButton.tsx:24`: `return links.find(({ pluginId }) => pluginId === 'grafana-lokiexplore-app');`. No link to Traces Drilldown or any other O11y app exists.

**Current state in Traces Drilldown:** No "open value in" destination menu exists. No popover or context-menu component is attached to an attribute value. A related but different pattern exists at `src/addedComponents/EntityAssertionsWidget/EntityAssertionsWidget.tsx:83`: `returnToPrevious={true}` passed into a fixed, single-destination embedded widget keyed on `serviceName`, with no click-driven menu and no branching to multiple destination apps.

**Related issue:** Net-new relative to #1343 [2], #1344 [3], and #1345 [4].

## 6. "Return to previous" affordance on outbound O11y links

**Capability:** When a link takes the user out of Metrics Drilldown into another O11y app, provide a way to return to the previous Metrics Drilldown view without losing context.

**Source:** The product design doc [5]: "Stage 1: Navigate back into Drilldown. Leverages a 'Return to previous' feature to let users return to their previous view after navigating into O11y, so they can explore safely without losing context. This pattern is already used in O11y Service view -> Kubernetes."

**Current state in Metrics Drilldown:** `src/MetricScene/RelatedLogs/OpenInLogsDrilldownButton.tsx`, the one existing outbound link in the repository, has no `returnToPrevious` prop or equivalent mechanism anywhere in its source.

**Current state in Traces Drilldown:** A working implementation exists at `src/addedComponents/EntityAssertionsWidget/EntityAssertionsWidget.tsx:83`, which passes `returnToPrevious={true}` into the embedded Asserts/App O11y component, consumed via `usePluginComponent<EntityAssertionsWidgetProps>('grafana-asserts-app/entity-assertions-widget/v1')` at lines 22-24.

**Related issue:** Net-new relative to #1343 [2], #1344 [3], and #1345 [4].

## 7. Sort/prioritize OTel attributes first in label filters and breakdowns

**Capability:** Show OTel-recognized attributes ahead of other attributes everywhere Metrics Drilldown exposes a label list, including filters and breakdowns, matching the approach Logs Drilldown already uses.

**Source:** The bet document [6], Logs Drilldown section: "Logs Drilldown sorts resource attributes in label filters by showing OTel attributes first (likely common across telemetry signals); this should be replicated in other Drilldown apps for consistency in label filters, label breakdowns, and other areas that expose labels. Could go further: frequently used attributes higher in the list, so order becomes frequently used > OTel attributes/groups > all other attributes."

**Current state in Metrics Drilldown:** A partial version exists in the Attribute Explorer (MetricScene) only. Priority attributes render first, bounded by `src/MetricScene/AttributeExplorer/PrometheusAttributeExplorer.tsx:104`: `const MAX_PRIORITY_ATTRIBUTES = 6;`, surfaced through the badges described in candidate 4. No evidence confirms the same OTel-first ordering in the MetricsReducer-level label and breakdown sidebar.

**Current state in Traces Drilldown:** No OTel-first ordering exists. The sidebar's attribute list is alphabetically sorted by default, `src/components/Explore/AttributesSidebar.tsx:120`: `.sort((a, b) => a.label.localeCompare(b.label));`. The only priority-front mechanism is user-selected favorites: for the Resource and Span tabs, favorited attributes are pulled out and sorted to the front by the user's own custom order (lines 158-165), with non-favorites remaining in alphabetical order beneath them. This ordering is user-driven, not OTel-driven.

**Related issue:** Net-new relative to #1343 [2], #1344 [3], and #1345 [4].

## 8. Tabbed default-starting-attribute filter UI

**Capability:** Offer a tabbed filter UI that defaults the user to a starting attribute, for example service name, with the ability to add more attribute filters, matching the approach Logs Drilldown already uses.

**Source:** The bet document [6], Logs Drilldown section: "Logs Drilldown filters by service name first via a tabbed UI where users select an attribute, shown by default, with users able to add additional attribute filters; other Drilldowns could follow a similar pattern (explicitly choosing a starting OTel resource attribute filter) but would need design work for a tabbed attribute approach."

**Current state in Metrics Drilldown:** No tabbed default-starting-attribute filter UI exists in `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx` or elsewhere in the filter UI covered under candidate 3.

**Current state in Traces Drilldown:** A tabbed attribute UI exists for a different purpose. `src/components/Explore/AttributesSidebar.tsx:297-308` builds the `scopeButtons` array: All, Resource, and Span by default (lines 298-300), with Favorites unshifted onto the front of the array when enabled (line 304: `scopeButtons.unshift({`). The tab strip is a scope selector; it does not set a default starting attribute the way Logs Drilldown does.

**Related issue:** Net-new relative to #1343 [2], #1344 [3], and #1345 [4].

## 9. Instrument/track engagement on OTel cross-app links

**Capability:** Capture clicks on OTel-driven links and cross-app navigation actions, including moves between Drilldown apps, to measure engagement.

**Source:** The bet document [6], All Drilldowns section: "Capture clicks/actions taken for links and other OTel-specific buttons or views opened (and moves between plugins from links)... Track engagement rate of people moving/clicking links between Drilldown apps and other solutions (e.g. Knowledge Graph, DB O11y), i.e. crossover sessions from this dashboard."

**Current state in Metrics Drilldown:** The existing outbound link already reports a click event. `src/MetricScene/RelatedLogs/OpenInLogsDrilldownButton.tsx:53`: `onClick={() => reportExploreMetrics('related_logs_action_clicked', { action: 'open_logs_drilldown' })}`. The same `reportExploreMetrics` mechanism tracks sidebar filter interactions, `src/MetricsReducer/SideBar/sections/MetricsFilterSection/MetricsFilterSection.tsx:308,354`: `reportExploreMetrics('sidebar_hierarchical_prefix_opened', { prefix });` and `reportExploreMetrics('sidebar_prefix_filter_applied', {`. No link to Traces Drilldown or any other O11y app exists yet to instrument, and no event carries the cross-plugin-move semantic meaning the bet document [6] describes.

**Current state in Traces Drilldown:** General click-instrumentation infrastructure exists and is used extensively, through a shared `reportAppInteraction` helper (`utils/analytics`) called from at least a dozen components, for example tab changes (`src/components/Explore/TracesByService/TracesByServiceScene.tsx:278`) and panel-menu actions (`src/components/Explore/panels/PanelMenu.tsx:125`). None of these calls are tied to an attribute-value-driven cross-app link or to the `EntityAssertionsWidget` component: a search of `src/addedComponents` for `reportAppInteraction`, `trackEvent`, or `analytics` found no matches.

**Related issue:** Net-new relative to #1343 [2], #1344 [3], and #1345 [4].

## 10. Surface an entity-level summary/insight in the metric scene

**Capability:** Surface a summary and, or links about, the entity, for example a service or cluster, that a metric's signals point to.

**Source:** The bet document [6], All Drilldowns section: "Find the entity that signals are telling us about." The same section [6] continues: "provide a summary and/or links, since users want to find which layer in the stack has the issue." The bet document [6] gives no corresponding GitHub issue number for this statement.

**Current state in Metrics Drilldown:** No entity summary or insights panel exists. The `kgMetricType` override is a separate mechanism, driven by Knowledge Graph and Asserts data, that affects only metric-type and panel-type resolution. `src/shared/GmdVizPanel/matchers/getMetricType.ts:26-28`:

  ```
  if (kgMetricType) {
    return mapKgMetricType(kgMetricType);
  }
  ```

  and `src/shared/GmdVizPanel/GmdVizPanel.tsx:210-213`:

  ```
  if (queryConfig.kgMetricType) {
    this.setState({ metricTypeResolved: true });
    return;
  }
  ```

  The mechanism does not display an entity summary anywhere in either file.

**Current state in Traces Drilldown:** The closest related working code is `src/addedComponents/EntityAssertionsWidget/EntityAssertionsWidget.tsx:21-86`, which embeds an externally exposed Asserts/App O11y component keyed on `serviceName` via `usePluginComponent<EntityAssertionsWidgetProps>('grafana-asserts-app/entity-assertions-widget/v1')` (lines 22-24), consumed at `src/pages/Explore/TraceExploration.tsx:420`.

**Related issue:** Net-new relative to #1343 [2], #1344 [3], and #1345 [4].

## Net-new candidates

The following candidates are not covered by #1343 [2], #1344 [3], or #1345 [4]:

- Candidate 5: "Open value in" multi-destination navigation menu for attribute values
- Candidate 6: "Return to previous" affordance on outbound O11y links
- Candidate 7: Sort/prioritize OTel attributes first in label filters and breakdowns
- Candidate 8: Tabbed default-starting-attribute filter UI
- Candidate 9: Instrument/track engagement on OTel cross-app links
- Candidate 10: Surface an entity-level summary/insight in the metric scene
