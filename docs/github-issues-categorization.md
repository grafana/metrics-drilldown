# GitHub Issues Categorization

> Categorization of all 109 open issues by coding complexity and challenge level.
> Generated: 2026-03-18

---

## 1. Good First Issues (15 issues)

Well-scoped tasks with clear boundaries, minimal context needed, and low risk of unintended side effects. Ideal for new contributors.

### Already Labeled "Good First Issue"

| # | Title | Notes |
|---|-------|-------|
| [#1142](https://github.com/grafana/metrics-drilldown/issues/1142) | Remove disabled setting from the metrics reducer sidebar | Remove a hard-coded disabled settings icon; delete unused component code |
| [#1124](https://github.com/grafana/metrics-drilldown/issues/1124) | Update group field type in `links.ts` when `@grafana/data` exports it | One-line type update after dependency bump |
| [#1123](https://github.com/grafana/metrics-drilldown/issues/1123) | Remove heatmap transformation no-data workaround | Delete a workaround once upstream fix ships |

### Recommended as Good First Issues

| # | Title | Notes |
|---|-------|-------|
| [#1099](https://github.com/grafana/metrics-drilldown/issues/1099) | Replace hardcoded query-library component ID with `PluginExtensionExposedComponents` enum | Replace 2 hardcoded strings with an enum; the issue describes exactly where |
| [#1086](https://github.com/grafana/metrics-drilldown/issues/1086) | UI fix: select button inconsistency | Change button variant in one component to match the other; purely cosmetic |
| [#862](https://github.com/grafana/metrics-drilldown/issues/862) | Remove `MetricSelectScene` cancelled request workaround | Remove dead workaround code from `useCatchExceptions.ts` |
| [#1032](https://github.com/grafana/metrics-drilldown/issues/1032) | Audit pnpm overrides | Check `package.json` overrides and remove any that are no longer needed |
| [#947](https://github.com/grafana/metrics-drilldown/issues/947) | Bookmarks list not coded as semantic list | Change `<div>` wrappers to `<ul>/<li>` in `BookmarksListScene` |
| [#948](https://github.com/grafana/metrics-drilldown/issues/948) | Sidebar navigation buttons not coded as list | Change `<div>` wrappers to `<ul>/<li>` in `SideBar.tsx` |
| [#945](https://github.com/grafana/metrics-drilldown/issues/945) | Missing `<h1>` heading on main application pages | Add an `<h1>` to main page components |
| [#950](https://github.com/grafana/metrics-drilldown/issues/950) | Radio button missing visible/accessible label | Add `aria-label` to Prometheus function radio button |
| [#946](https://github.com/grafana/metrics-drilldown/issues/946) | Radio button group without fieldset/legend | Wrap radio group in `<fieldset>` with `<legend>` |
| [#979](https://github.com/grafana/metrics-drilldown/issues/979) | Missing focus indicator on "Clear" button | Add CSS focus styles to the sidebar Clear button |
| [#978](https://github.com/grafana/metrics-drilldown/issues/978) | Missing focus indicator on sidebar checkboxes/radio buttons | Add CSS focus styles to sidebar form controls |
| [#776](https://github.com/grafana/metrics-drilldown/issues/776) | Update docs to align with 12.3 UI | Documentation-only; update screenshots and workflows |

---

## 2. Small Bugs (11 issues)

Isolated bug fixes with clear symptoms, typically touching 1–3 files. May require some investigation but the fix scope is limited.

| # | Title | Notes |
|---|-------|-------|
| [#1138](https://github.com/grafana/metrics-drilldown/issues/1138) | Saved Queries: only display Prometheus queries to select | Add a data source type filter when listing saved queries |
| [#1020](https://github.com/grafana/metrics-drilldown/issues/1020) | Adding label from breakdown can duplicate label filter | Guard "Add to filter" action against existing labels |
| [#1067](https://github.com/grafana/metrics-drilldown/issues/1067) | Metrics reducer shows 10,000 metrics when data source has 40,000 series limit | Investigate disconnect between API limit and displayed count |
| [#1059](https://github.com/grafana/metrics-drilldown/issues/1059) | Loki recording rule incorrectly gets rate function → no data | Fix auto-query logic for recording rules with existing aggregations |
| [#847](https://github.com/grafana/metrics-drilldown/issues/847) | Errors in Frontend O11y don't contain extra context | Improve Faro error instrumentation to include contextual info |
| [#887](https://github.com/grafana/metrics-drilldown/issues/887) | Incorrect queries for breakdown of histogram metrics | Fix PromQL generation in label breakdown for histogram types |
| [#1137](https://github.com/grafana/metrics-drilldown/issues/1137) | Error on Metrics Drilldown page on macOS Safari | Browser-specific bug; requires investigation and compat fix |
| [#1070](https://github.com/grafana/metrics-drilldown/issues/1070) | Plugin error | Minimal description; needs triage/reproduction first |
| [#982](https://github.com/grafana/metrics-drilldown/issues/982) | Cut-off focus indicator on main metric panel | CSS overflow fix on metric panel container |
| [#981](https://github.com/grafana/metrics-drilldown/issues/981) | Cut-off focus indicator on metrics in metric select view | CSS overflow fix on metric grid items |
| [#980](https://github.com/grafana/metrics-drilldown/issues/980) | Cut-off focus indicator on sidebar icons | CSS overflow fix on sidebar icon containers |

---

## 3. Medium Complexity (25 issues)

Features and fixes requiring meaningful engineering work across multiple files/components, but with a well-understood scope. No architectural overhaul needed.

### Feature Enhancements

| # | Title | Notes |
|---|-------|-------|
| [#871](https://github.com/grafana/metrics-drilldown/issues/871) | Sort breakdown panels by cardinality | Add a sort option to the breakdown view; query cardinality data |
| [#829](https://github.com/grafana/metrics-drilldown/issues/829) | Improve native histogram breakdown | Modify breakdown query logic and panel filtering for native histograms |
| [#401](https://github.com/grafana/metrics-drilldown/issues/401) | RelatedLogs: Provide feedback about unhealthy data sources | Add UI indicators and remediation instructions for bad data sources |
| [#449](https://github.com/grafana/metrics-drilldown/issues/449) | Link-type extensions should carry over basic Prometheus functions | Preserve function context when navigating from Explore/dashboards |
| [#421](https://github.com/grafana/metrics-drilldown/issues/421) | Breakdown tab: update main timeseries with all label values | Change behavior of main panel when label is selected |
| [#241](https://github.com/grafana/metrics-drilldown/issues/241) | Opt in for y-axis scaling in breakdown panels | Add toggle control and scaling logic |
| [#779](https://github.com/grafana/metrics-drilldown/issues/779) | Make GMD more keyboard friendly | Auto-focus search on load, fix tab indices |
| [#1018](https://github.com/grafana/metrics-drilldown/issues/1018) | Clear sidebar filter "reset" mechanism | Add a more prominent reset/clear-all action |
| [#1016](https://github.com/grafana/metrics-drilldown/issues/1016) | Use fuzzy search in quick search | Replace exact filter with fuzzy matching library |
| [#597](https://github.com/grafana/metrics-drilldown/issues/597) | Allow user to opt-in to query healing | Add opt-in UI instead of automatic query healing |
| [#976](https://github.com/grafana/metrics-drilldown/issues/976) | Persist filters when switching data sources | State management change for data source switching |
| [#1000](https://github.com/grafana/metrics-drilldown/issues/1000) | Provide UI feedback when user encounters limited metrics | Add banner/notification when series limit is hit |
| [#965](https://github.com/grafana/metrics-drilldown/issues/965) | Error Prevention: bookmark deletion confirmation | Add confirm dialog or undo for bookmark deletion |

### SourceMetrics / Knowledge Graph Extensions

| # | Title | Notes |
|---|-------|-------|
| [#1058](https://github.com/grafana/metrics-drilldown/issues/1058) | SourceMetrics: set metric type via prop | Accept and use an optional `metricType` prop |
| [#1131](https://github.com/grafana/metrics-drilldown/issues/1131) | SourceMetrics: additional aggregation functions for gauges | Accept optional `aggFunction` per metric |
| [#1130](https://github.com/grafana/metrics-drilldown/issues/1130) | SourceMetrics: per-metric `rate_interval` for counters | Accept optional fixed interval per metric |

### Accessibility (Multi-file)

| # | Title | Notes |
|---|-------|-------|
| [#951](https://github.com/grafana/metrics-drilldown/issues/951) | Tab panels not properly associated with tabs | Add `role="tabpanel"`, `aria-labelledby` to action bar tabs |
| [#949](https://github.com/grafana/metrics-drilldown/issues/949) | Metrics panels collection lacks list semantics | Add list role to grid of 100+ metric panels |
| [#963](https://github.com/grafana/metrics-drilldown/issues/963) | Status Messages not announced to assistive tech | Add `aria-live` regions for dynamic status updates |
| [#974](https://github.com/grafana/metrics-drilldown/issues/974) | Non-text Contrast issues | Fix multiple components that remove focus indicators |
| [#973](https://github.com/grafana/metrics-drilldown/issues/973) | Text Spacing issues | Fix fixed-height constraints that clip text |

### Chores / Refactors

| # | Title | Notes |
|---|-------|-------|
| [#1100](https://github.com/grafana/metrics-drilldown/issues/1100) | Update media queries to container queries | Systematic CSS migration across multiple components |
| [#928](https://github.com/grafana/metrics-drilldown/issues/928) | Replace deprecated `config.apps` usage | API migration following upstream deprecation |
| [#863](https://github.com/grafana/metrics-drilldown/issues/863) | Refactor PanelMenu to use member functions | Blocked upstream; refactor when `VizPanelMenu` interface changes |
| [#941](https://github.com/grafana/metrics-drilldown/issues/941) | Add session replay to Faro instrumentation | Integrate replay SDK with async loading and feature toggle |

---

## 4. Large / Architectural Changes (16 issues)

Significant engineering effort spanning multiple subsystems. May require new abstractions, data flow changes, or cross-team coordination.

| # | Title | Notes |
|---|-------|-------|
| [#1068](https://github.com/grafana/metrics-drilldown/issues/1068) | React 19 readiness | Framework migration; audit all React API usage for breaking changes |
| [#1066](https://github.com/grafana/metrics-drilldown/issues/1066) | React 19 Upgrade compatibility | Related to #1068; ensure plugin works with Grafana 13's React 19 |
| [#619](https://github.com/grafana/metrics-drilldown/issues/619) | Experiment with Scenes React | Explore migrating from `@grafana/scenes` to `@grafana/scenes-react` |
| [#499](https://github.com/grafana/metrics-drilldown/issues/499) | Poor performance in Breakdown scene with many label values | Performance overhaul: 2,500+ panel rendering; virtualization needed |
| [#999](https://github.com/grafana/metrics-drilldown/issues/999) | Overcoming the upstream Series Limit to surface all metrics | Complex data fetching strategy to work around 40k limit |
| [#1132](https://github.com/grafana/metrics-drilldown/issues/1132) | SourceMetrics: per-metric label filters or multiple label variables | Requires rethinking how label filters are applied across multiple metrics |
| [#1029](https://github.com/grafana/metrics-drilldown/issues/1029) | Histogram comparison and analysis breakdown | Entirely new feature: bucket selection, comparison UI, statistical analysis |
| [#650](https://github.com/grafana/metrics-drilldown/issues/650) | Suggested labels in the metric filters | New feature requiring label relevance heuristics or ML |
| [#311](https://github.com/grafana/metrics-drilldown/issues/311) | Info metrics: join query builder | New query building feature for info metric joins |
| [#738](https://github.com/grafana/metrics-drilldown/issues/738) | Query TSDB for metric name matches in search | New search infrastructure querying TSDB directly |
| [#1001](https://github.com/grafana/metrics-drilldown/issues/1001) | Leverage upstream pagination for metric names | Data fetching overhaul depending on upstream `@grafana/prometheus` changes |
| [#370](https://github.com/grafana/metrics-drilldown/issues/370) | Reliable Prometheus DS language provider support | Cross-version compatibility layer for breaking upstream changes |
| [#940](https://github.com/grafana/metrics-drilldown/issues/940) | Recorded Queries Data Migration and Feature Removal | Data migration across all Drilldown apps + feature flag removal |
| [#1037](https://github.com/grafana/metrics-drilldown/issues/1037) | Asserts: Multilane insights and annotations | Integration feature with Asserts; multi-lane timeline UI |
| [#596](https://github.com/grafana/metrics-drilldown/issues/596) | Optimizing for lower consumption | Epic: reduce TSDB consumption across multiple query paths |
| [#1019](https://github.com/grafana/metrics-drilldown/issues/1019) | Sort metrics by firing alerts, active SLO, anomalies | Cross-system integration (alerts, SLOs, anomaly detection) |

---

## 5. Research Spikes (7 issues)

Investigation tasks that produce design docs, findings, or prototypes — not production code.

| # | Title | Notes |
|---|-------|-------|
| [#1085](https://github.com/grafana/metrics-drilldown/issues/1085) | Spike: Dashboard usage per metric | Research how to overcome 500-dashboard search limit |
| [#1022](https://github.com/grafana/metrics-drilldown/issues/1022) | UX Research: what should persist when data source changes? | User research on filter persistence expectations |
| [#1017](https://github.com/grafana/metrics-drilldown/issues/1017) | Spike: series/panel comparison | Design exploration for comparing metrics/labels |
| [#1133](https://github.com/grafana/metrics-drilldown/issues/1133) | Spike: cost benefits of individual query changes vs full query param | Cost/benefit analysis for SourceMetrics query approach |
| [#689](https://github.com/grafana/metrics-drilldown/issues/689) | UX research: Prometheus function in Breakdown view | UX research for function selection in breakdown |
| [#1041](https://github.com/grafana/metrics-drilldown/issues/1041) | Research new SLO thresholds and new SLOs | Evaluate and improve existing SLOs |
| [#1040](https://github.com/grafana/metrics-drilldown/issues/1040) | Unified KPI dashboard for Drilldown | Dashboard design and creation |

---

## 6. Operations / CI / Tooling (13 issues)

Infrastructure, automation, deployment, and developer experience improvements.

| # | Title | Notes |
|---|-------|-------|
| [#684](https://github.com/grafana/metrics-drilldown/issues/684) | CI/CD Improvements | Epic for deployment automation |
| [#412](https://github.com/grafana/metrics-drilldown/issues/412) | Streamlining deployment | Epic for deployment strategy improvements |
| [#411](https://github.com/grafana/metrics-drilldown/issues/411) | One-click rollbacks | Spike: rollback strategy for plugin catalog |
| [#408](https://github.com/grafana/metrics-drilldown/issues/408) | Operational dashboards | Create monitoring dashboards for the app itself |
| [#585](https://github.com/grafana/metrics-drilldown/issues/585) | Deploy notifications to Slack | Automated Slack notifications on deploy |
| [#587](https://github.com/grafana/metrics-drilldown/issues/587) | Session-based health check reporting | Improve health check dashboard accuracy |
| [#592](https://github.com/grafana/metrics-drilldown/issues/592) | Automated issue creation from Slack | Slack→GitHub issue automation |
| [#646](https://github.com/grafana/metrics-drilldown/issues/646) | GitHub Action for Expected Start Date | Automation: set date when issue moves to In Progress |
| [#656](https://github.com/grafana/metrics-drilldown/issues/656) | Grafana Bench integration | Test against all Grafana release channels |
| [#925](https://github.com/grafana/metrics-drilldown/issues/925) | Integrate Doc Detective | Automated doc-drift detection |
| [#1039](https://github.com/grafana/metrics-drilldown/issues/1039) | Unified escalation dashboard | Create cross-Drilldown-app escalation dashboard |
| [#663](https://github.com/grafana/metrics-drilldown/issues/663) | Split test: sidebar open by default | A/B testing infrastructure + experiment |
| [#1097](https://github.com/grafana/metrics-drilldown/issues/1097) | A/B test saved queries icon placement | A/B testing for UI placement |

---

## 7. Testing Infrastructure (4 issues)

Improvements to the automated test suite and test environment.

| # | Title | Notes |
|---|-------|-------|
| [#537](https://github.com/grafana/metrics-drilldown/issues/537) | RelatedLogs: Create end-to-end tests | Blocked by #536; write E2E tests for Related Logs |
| [#536](https://github.com/grafana/metrics-drilldown/issues/536) | Provision Loki and Prometheus for Related Logs testing | Set up test data sources for E2E |
| [#239](https://github.com/grafana/metrics-drilldown/issues/239) | Use E2E plugin page object | Migrate custom E2E implementation to official page objects |
| [#336](https://github.com/grafana/metrics-drilldown/issues/336) | Enhance dashboard/alert usage tests | Add network assertion tests for lazy loading |

---

## 8. Epics / Meta Issues (8 issues)

Parent issues or tracking issues that contain multiple sub-tasks.

| # | Title | Notes |
|---|-------|-------|
| [#1129](https://github.com/grafana/metrics-drilldown/issues/1129) | Epic: Knowledge Graph/RCA Workbench source metrics | Parent for #1130, #1131, #1132, #1133, #1058 |
| [#1028](https://github.com/grafana/metrics-drilldown/issues/1028) | Histogram epic 2026 | Parent for histogram improvements and bug fixes |
| [#977](https://github.com/grafana/metrics-drilldown/issues/977) | Parent: WCAG 2.4.7 Focus Visible | Parent for #978, #979, #980, #981, #982 |
| [#944](https://github.com/grafana/metrics-drilldown/issues/944) | Parent: WCAG 1.3.1 Info and Relationships | Parent for #945, #946, #947, #948, #949, #950, #951 |
| [#966](https://github.com/grafana/metrics-drilldown/issues/966) | Parent: WCAG 1.3.4 Orientation | Parent for #967, #968, #969 |
| [#880](https://github.com/grafana/metrics-drilldown/issues/880) | Accessibility Features epic | Umbrella for all a11y work |
| [#415](https://github.com/grafana/metrics-drilldown/issues/415) | Metrics Scene UX improvements | Links to external tracking doc |
| [#11](https://github.com/grafana/metrics-drilldown/issues/11) | Fast follows after first working version | Legacy tracking issue |

---

## 9. Blocked / External Dependency (2 issues)

Issues that cannot be worked on until upstream changes land.

| # | Title | Notes |
|---|-------|-------|
| [#801](https://github.com/grafana/metrics-drilldown/issues/801) | Plugin Fails After Auto-Update | Blocked upstream; Grafana plugin loading issue |
| [#863](https://github.com/grafana/metrics-drilldown/issues/863) | Refactor PanelMenu | Blocked by `@grafana/scenes` interface limitations |

---

## 10. Cross-Team / Integration (4 issues)

Work requiring coordination with other Grafana teams.

| # | Title | Notes |
|---|-------|-------|
| [#426](https://github.com/grafana/metrics-drilldown/issues/426) | Integrate Metrics Drilldown into Asserts | Epic for Asserts embedding |
| [#583](https://github.com/grafana/metrics-drilldown/issues/583) | Consistent Entry/Exit points with Asserts | Cross-app UX consistency audit |
| [#911](https://github.com/grafana/metrics-drilldown/issues/911) | Mini embedded drilldown fast follow | Follow-up refinements for embedded component |
| [#578](https://github.com/grafana/metrics-drilldown/issues/578) | Provide a way for users to save their labels | Needs grooming; scope unclear |

---

## Summary

| Category | Count | Key Takeaway |
|----------|------:|--------------|
| Good First Issues | 15 | Well-scoped, mostly a11y fixes and code cleanup |
| Small Bugs | 11 | Isolated fixes with clear symptoms |
| Medium Complexity | 25 | The bulk of actionable feature work |
| Large / Architectural | 16 | High-impact but high-effort changes |
| Research Spikes | 7 | Investigation-only, no production code |
| Operations / CI / Tooling | 13 | Infrastructure and automation |
| Testing Infrastructure | 4 | Test environment and coverage |
| Epics / Meta | 8 | Tracking issues (don't assign directly) |
| Blocked / External | 2 | Waiting on upstream |
| Cross-Team / Integration | 4 | Requires coordination |
| **Total** | **105** | 4 issues appear in multiple categories |
