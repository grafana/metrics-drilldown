# Changelog

## 1.0.21

##### Chores

*  rm pre-version script check (#844) (bb4155ee)
*  delete empty css classes, delete redundant margin/padding properties (#818) (62ef65bd)
*  bump version to v1.0.20 (#827) (afb1e4a4)
*  bump version to v1.0.19 (#799) (974d559a)
*  reduce the number of screenshot tests (#791) (f173bc1e)
*  bump `@grafana/assistant` to `0.1.0` (#783) (384f8cd8)
*  bump version to v1.0.18 (#781) (e429035c)
*  upgrade `@grafana/prometheus` (#767) (af7523f1)
*  bump @grafana/create-plugin configuration to 5.26.9 (#748) (7db289b4)
*  replace custom text styling with Text component in Bookmarks components (#749) (e91b6b42)
*  add git ref sha in CD (#755) (ce904222)
*  argo cd to ops (#752) (2fda597c)
*  cd deploys to dev (#747) (9a71b97c)
*  Bump version 1.0.17 (#743) (723dfac5)
*  version precheck script (#740) (26aa5c9b)
* **deps:**
  *  update dependency eslint-config-prettier to v8.10.2 (#833) (570048e3)
  *  update dependency @types/node to v20.19.24 (#832) (cad8a0e3)
  *  update dependency webpack to v5.102.1 (#837) (716ca1ad)
  *  update dependency @grafana/assistant to v0.1.3 (#831) (8b75b59f)
  *  update dependency @grafana/scenes to v6.42.2 (#834) (15cf1df3)
  *  update dependency @grafana/tsconfig to v2.0.1 (#825) (05949515)
  *  update dependency typescript to v5.9.3 (#817) (de5ed58e)
  *  update dependency @swc/core to v1.14.0 (#812) (d2b54f48)
  *  update dependency sass to v1.93.3 (#815) (56dbac3e)
  *  update dependency leven to v4.1.0 (#814) (0543e672)
  *  pin dependencies (#785) (c8b31460)
  *  update dependency @testing-library/jest-dom to v6.9.1 (#813) (94f1a378)
  *  update dependency @grafana/scenes to v6.40.1 (#787) (dc6309eb)
  *  update grafana monorepo to v12.2.1 (#811) (55992411)
  *  update dependency @lezer/common to v1.3.0 (#808) (9d9c2eaa)
  *  update mcr.microsoft.com/playwright docker tag to v1.56.1 (#797) (e7624a55)
  *  update dependency eslint-plugin-sonarjs to ^3.0.4 (#789) (f49e317f)
  *  update actions/checkout action to v4.3.0 (#803) (2df83166)
  *  update dependency @types/node to ^20.19.7 (#788) (29bf75e9)
  *  update npm to v10.9.4 (#798) (c45ce011)
  *  update dependency @grafana/lezer-logql to v0.2.9 (#786) (1336089b)
* **EndToEnd:**  Upgrade Playwright to v1.56.0 (#763) (24d5d6b1)
* **Docker:**  Increase health check retries count (#746) (4ec848d5)

##### Documentation Changes

*  add explanation of related metrics (#809) (61b3d522)
*  Add explanation for 40k metric limit (#800) (16fe57e5)

##### New Features

*  add breadcrumbs (#810) (12cc8fa4)
*  add panel to dashboard (#792) (b8f72d00)
*  grafana assistant quick start questions (#774) (dab363d5)
*  sort metrics purely alphabetically (#771) (7ed07377)
*  DataSource Configuration Extensions (#572) (8cd8d931)
*  Use metadata to distinguish metric type (#737) (a1f8747b)
* **MetricsList:**  Remove configure Prometheus function button (#821) (833a4fba)
* **ci:**  version bump and changelog action (#816) (a7bbf3ff)
* **MetricsReducer:**
  *  Add recent metrics filter in the sidebar (#712) (d155a0e4)
  *  re-enable __name__ in the AdHoc filters (#742) (8ffaf5f3)
* ***:**  Introduce presets for "_info" metrics (#744) (4d76d818)
* **Breakdown:**  Disable __ignore_usage__ label for the main query (#745) (1e0f19c5)
* **GmdVizPanel:**  Always consider the metric metadata to render the proper panel type (#723) (9dc63b9b)

##### Bug Fixes

*  update query with duplicate utf-8 metric names (#839) (fa366df7)
*  defer Loki health checks in the Metric Scene (#830) (499402e5)
*  ensure visible panels have data fetching priority (#820) (cd027135)
*  playwright published action (#794) (c9a0079e)
*  undefined metadata issue (#793) (b3b2c8da)
*  use sub url explicitly in open in explore link (#768) (1d7f9931)
*  bundle size impact of i18n init (#769) (158f0bfc)
*  init plugin translations for Scenes (#765) (4a310940)
* **Breakdown:**  Fix missing panel data (#828) (fb277012)
* **Sidebar:**
  *  Remove extra space and border radius (#823) (bfc38b7e)
  *  Fix group by status and behaviour (#736) (a1875c5b)
* **PluginInfo:**  Fix missing Prometheus info (#822) (baa5fbb3)
* **MetricDatasourceHelper:**  Fix cache refresh when changing data source (#741) (a4bc0c31)

##### Refactors

*  Replace custom flexbox CSS with Stack components in DataTrail.tsx (#806) (df19d349)
*  Replace custom flexbox CSS with Stack components in SideBar.tsx (#795) (17c4f3ca)
*  Replace custom flexbox CSS with Stack component in MetricsReducer.tsx (#778) (a3e9f37d)
*  Replace custom flexbox CSS with Stack components in MetricsGroupByRow.tsx (#770) (09594c2a)
*  Replace custom flexbox CSS with Stack component in ListControls.tsx (#758) (9875c864)
*  feplace custom flexbox CSS with Stack component in BookmarksList.tsx (#757) (4a4dc760)
*  Replace custom flexbox CSS with Stack component in UsageData.tsx (#756) (5ab41ab2)
* **GmdVizPanel:**  Centralize how panels and queries are built (#730) (6b65346b)

##### Tests

*  add grafana-bench for e2e tests (#764) (2723dfdc)


## v1.0.20

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.20>

## v1.0.19

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.19>

## v1.0.18

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.18>

## v1.0.17

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.17>

## v1.0.16

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.16>

## v1.0.15

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.15>

## v1.0.14

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.14>

## v1.0.13

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.13>

## v1.0.12

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.12>

## v1.0.11

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.11>

## v1.0.10

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.10>

## v1.0.9

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.9>

## v1.0.8

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.8>

## v1.0.7

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.7>

## v1.0.6

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.6>

## v1.0.5

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.5>

## v1.0.4

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.4>

## v1.0.3

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.3-corrected>

## v1.0.2

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.2>

## v1.0.2-0

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.2-0>

## 1.0.1

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.1>

## 1.0.0

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0>

## 1.0.0-9

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-9>

## 1.0.0-8

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-8>

## 1.0.0-7

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-7>

## 1.0.0-6

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-6>

## 1.0.0-5

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-5>

## 1.0.0-4

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-4>

## 1.0.0-3

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-3>

## 1.0.0-2

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-2>

## 1.0.0-1

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-1>

## 1.0.0-0

See <https://github.com/grafana/metrics-drilldown/releases/tag/v1.0.0-0>

## 0.1.0

Initial release.
