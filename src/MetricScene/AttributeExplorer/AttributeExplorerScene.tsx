
import { css } from '@emotion/css';
import { getDefaultTimeRange, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
// eslint-disable-next-line sonarjs/deprecation -- unavoidable until min Grafana >= 13.1; @grafana/runtime/unstable not on host before then
import { getDataSourceSrv, useChromeHeaderHeight } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneVariable,
} from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricDatasourceHelper, type PrometheusRuntimeDatasource } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { logger } from 'shared/logger/logger';
import { VAR_DATASOURCE, VAR_FILTERS, VAR_METRIC } from 'shared/shared';
import { isAdHocFiltersVariable } from 'shared/utils/utils.variables';

import { type DatasetContext } from './AttributeDistribution';
import { type ActiveFilter } from './attributeDistributionState';
import {
  fetchDefaultLowerThreshold,
  getOtelPriorityAttributes,
  groupFiltersByFieldAndOperator,
  isHistogramWithThreshold,
  PrometheusAttributeExplorer,
} from './PrometheusAttributeExplorer';
import { MetricScene } from '../MetricScene';

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

// Canonical per-field signature (operator+value pairs, order-independent so a multi-value field's
// entries can be compared regardless of ordering), used by handleFiltersChange below to detect which
// fields a given call actually changed. `filters` there is AttributeDistribution's full, controlled
// list, which also includes fields it absorbed as "external" (page-set) and is merely passing through
// unchanged -- not fields the sidebar itself touched.
function canonicalFilterSignatures(filters: ActiveFilter[]): Map<string, string> {
  const byField = new Map<string, Array<[string, string]>>();
  for (const f of filters) {
    const entries = byField.get(f.field) ?? [];
    entries.push([f.operator, f.value]);
    byField.set(f.field, entries);
  }
  // JSON.stringify over a sorted array, not manual delimiter concatenation: a delimiter character
  // could collide with a real filter value and make two genuinely different value sets compare as
  // equal (or vice versa), silently defeating the comparison this signature exists for.
  const signatures = new Map<string, string>();
  for (const [field, entries] of byField) {
    const sorted = [...entries].sort(([opA, valA], [opB, valB]) => (opA === opB ? valA.localeCompare(valB) : opA.localeCompare(opB)));
    signatures.set(field, JSON.stringify(sorted));
  }
  return signatures;
}

interface AttributeExplorerSceneState extends SceneObjectState {
  // Which OTel pass matched each priority attribute ('metric' vs 'resource'), so the sidebar can show
  // an accurate, specific reason per attribute instead of one caption for the whole priority group.
  attributeKinds: Record<string, 'metric' | 'resource'>;
  attributeLabels: Record<string, string>;
  datasourceUid: string;
  metric: string;
  metricType: MetricType;
  // False only until the very first OTel-priority detection has ever settled; never reset to false
  // again after that. AttributeDistribution now re-sorts in place when a fresh priority list arrives
  // later (see REORDER_BY_PRIORITY), so a routine refresh (time-range change, filter change) no longer
  // needs to unmount the explorer -- doing so would discard its pinned attributes, expanded sections,
  // and value snapshot just to reflect an updated priority list.
  otelPriorityReady: boolean;
  priorityAttributes: string[];
  query: string;
  selectedFilters: ActiveFilter[];
  timeRange: TimeRange;
}

export class AttributeExplorerScene extends SceneObjectBase<AttributeExplorerSceneState> {
  // Fields this sidebar has written into VAR_FILTERS avoid clobbering filters set by
  // other page surfaces, and avoid re-expanding an already-collapsed multi-value regex.
  private _sidebarFilterKeys = new Set<string>();

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_FILTERS, VAR_METRIC],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      if (variable.state.name === VAR_FILTERS) {
        this._syncSelectedFiltersFromVar();
      }
      // state.query embeds a one-time snapshot of VAR_FILTERS (see buildQueryExpression.ts), taken via
      // sceneGraph.interpolate rather than a live binding, so it must be rebuilt here too or it
      // silently keeps querying against whatever filters existed at the last datasource/metric change
      // instead of the page's current filters.
      this._updateQueryAndDatasource();
    },
  });

  // Discards a stale _resolveOtelPriority response if a newer query/datasource has superseded it.
  private _otelPriorityGeneration = 0;
  // Discards a stale _seedHistogramRangeIfNeeded response if a newer query/datasource/metricType has
  // superseded it. Separate from _otelPriorityGeneration since the two fetches are independent and
  // invalidating one shouldn't imply anything about the other.
  private _histogramSeedGeneration = 0;

  public constructor() {
    super({
      key: 'attribute-explorer',
      attributeKinds: {},
      attributeLabels: {},
      datasourceUid: '',
      metric: '',
      metricType: 'gauge',
      otelPriorityReady: false,
      priorityAttributes: [],
      query: '',
      selectedFilters: [],
      timeRange: getDefaultTimeRange(),
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    // Set before the methods below: _updateQueryAndDatasource triggers the histogram threshold seed,
    // which reads this.state.timeRange, so it must reflect the real page range on this very first run,
    // not the constructor's getDefaultTimeRange() placeholder.
    const timeRangeObj = sceneGraph.getTimeRange(this);
    this.setState({ timeRange: timeRangeObj.state.value });

    this._resolveMetricType();
    this._updateQueryAndDatasource();
    this._syncSelectedFiltersFromVar();

    this._subs.add(
      timeRangeObj.subscribeToState((newState) => {
        this.setState({ timeRange: newState.value });
        // Label discovery for OTel priority is time-range scoped (see _fetchOtelPriority), so without
        // this, changing the dashboard range leaves priorityAttributes stuck on the old range: labels
        // that disappeared stay shown as empty priority sections, and newly present OTel labels never
        // get prioritized. The existing generation guard in _resolveOtelPriority/_fetchOtelPriority
        // still discards this if a newer query/datasource change supersedes it first.
        this._resolveOtelPriority(this.state.datasourceUid, this.state.query);
        // A time range change can be the first moment a seed becomes possible (e.g. the initial range
        // had no data for this metric); harmless no-op via the guard below if a range or an explicit
        // user edit already exists.
        this._seedHistogramRangeIfNeeded();
      })
    );
  }

  private _resolveMetricType() {
    const metricScene = sceneGraph.getAncestor(this, MetricScene);
    const [gmdVizPanel] = sceneGraph.findDescendents(metricScene.state.body, GmdVizPanel);
    if (!gmdVizPanel) {
      return;
    }

    this.setState({ metricType: gmdVizPanel.state.metricType });

    this._subs.add(
      gmdVizPanel.subscribeToState((newState, prevState) => {
        if (newState.metricType !== prevState.metricType) {
          this.setState({ metricType: newState.metricType });
          // metricType arriving late (e.g. upgraded from a name-heuristic gauge guess to
          // native-histogram once metadata resolves) isn't caught by _updateQueryAndDatasource, which
          // already ran under the old, non-histogram metricType and exited without seeding.
          this._seedHistogramRangeIfNeeded();
        }
      })
    );
  }

  private _updateQueryAndDatasource() {
    const metric = sceneGraph.lookupVariable(VAR_METRIC, this)?.getValue()?.toString() ?? '';
    if (!metric) {
      return;
    }
    
    const expression = buildQueryExpression({ metric: { name: metric, type: this.state.metricType } });
    const query = sceneGraph.interpolate(this, expression);

    const dsVariable = sceneGraph.lookupVariable(VAR_DATASOURCE, this);
    const datasourceUid = (dsVariable?.getValue()?.toString() ?? '') as string;

    this.setState({ datasourceUid, metric, query });
    this._resolveOtelPriority(datasourceUid, query);
    this._seedHistogramRangeIfNeeded();
  }

  // Fires a one-time query, per metric, to pick a starting histogram lower threshold scaled to what
  // this metric actually reports (see fetchDefaultLowerThreshold). Guarded on histogramRange still
  // being undefined so this never overwrites a value the user has already set, or a seed that already
  // landed, regardless of how many times the surrounding lifecycle events re-fire (activation,
  // metricType upgrade, time range change).
  private _seedHistogramRangeIfNeeded() {
    const { datasourceUid, metricType, query, timeRange } = this.state;
    if (!datasourceUid || !query || !isHistogramWithThreshold(metricType)) {
      return;
    }

    const metricScene = sceneGraph.getAncestor(this, MetricScene);
    if (metricScene.state.histogramRange !== undefined) {
      return;
    }

    const generation = ++this._histogramSeedGeneration;
    const context: DatasetContext = {
      datasourceUid,
      metricType,
      query,
      timeRange: { from: timeRange.from.valueOf(), to: timeRange.to.valueOf() },
    };

    this._subs.add(
      fetchDefaultLowerThreshold(context).subscribe({
        next: (lowerSeconds) => {
          if (generation !== this._histogramSeedGeneration || lowerSeconds === undefined) {
            return;
          }
          // Re-checked at resolution time, not just at request time: a user could have typed an
          // explicit value while this query was in flight, which must win over a seed arriving after
          // the fact.
          if (metricScene.state.histogramRange === undefined) {
            metricScene.setHistogramRange({ lowerSeconds: Number(lowerSeconds.toPrecision(2)), upperSeconds: Number.POSITIVE_INFINITY });
          }
        },
        // Without this, a datasource/query failure here surfaces as an unhandled RxJS error instead of
        // just leaving the explorer on its documented DEFAULT_HISTOGRAM_RANGE fallback.
        error: (e) => {
          if (generation !== this._histogramSeedGeneration) {
            return;
          }
          logger.error(toError(e));
        },
      })
    );
  }

  private _resolveOtelPriority(datasourceUid: string, query: string) {
    const generation = ++this._otelPriorityGeneration;

    if (!datasourceUid || !query) {
      // Genuinely nothing to detect against, unlike the in-flight case below: clears down to empty
      // rather than leaving a stale list from a previous, now-invalid query/datasource hanging around.
      this.setState({ attributeKinds: {}, attributeLabels: {}, otelPriorityReady: true, priorityAttributes: [] });
      return;
    }

    // Deliberately does not clear attributeKinds/attributeLabels/priorityAttributes before the fetch
    // resolves: whatever was already known (from a previous query, or this one) stays visible and
    // valid-looking while a refresh is in flight, rather than flashing empty. AttributeDistribution's
    // REORDER_BY_PRIORITY re-sorts in place once the fresh list actually lands.
    this._fetchOtelPriority(datasourceUid, query, generation).catch((e) => {
      if (generation !== this._otelPriorityGeneration) {
        return;
      }
      logger.error(toError(e));
      this.setState({ otelPriorityReady: true });
    });
  }

  private async _fetchOtelPriority(datasourceUid: string, query: string, generation: number) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- unavoidable until min Grafana >= 13.1
    const ds = (await getDataSourceSrv().get(datasourceUid)) as unknown as PrometheusRuntimeDatasource;
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const labels = await MetricDatasourceHelper.fetchLabels({ ds, matcher: query, timeRange });
    if (generation !== this._otelPriorityGeneration) {
      return;
    }
    const { attributeKinds, attributeLabels, priorityAttributes } = getOtelPriorityAttributes(labels);
    this.setState({ attributeKinds, attributeLabels, otelPriorityReady: true, priorityAttributes });
  }

  private _syncSelectedFiltersFromVar() {
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!isAdHocFiltersVariable(filtersVar)) {
      return;
    }

    const stillPresentKeys = new Set(filtersVar.state.filters.map((f) => f.key));
    // Keep current selections for fields we own, unless externally removed from VAR_FILTERS. Not
    // re-derived from VAR_FILTERS: a collapsed multi-value regex can't be un-expanded unambiguously.
    const ours = this.state.selectedFilters.filter(
      (f) => this._sidebarFilterKeys.has(f.field) && stillPresentKeys.has(f.field)
    );

    // Fields we don't own: pick up plain =/!= filters set elsewhere so a pre-existing page filter
    // shows as selected. Regex filters on fields we don't own aren't representable here.
    const external: ActiveFilter[] = filtersVar.state.filters
      .filter((f) => !this._sidebarFilterKeys.has(f.key) && (f.operator === '=' || f.operator === '!='))
      .map((f) => ({ field: f.key, operator: f.operator as '=' | '!=', value: f.value }));

    this.setState({ selectedFilters: [...ours, ...external] });
  }

  public handleFiltersChange(filters: ActiveFilter[]) {
    const previousSidebarFilterKeys = this._sidebarFilterKeys;
    const previousSignatures = canonicalFilterSignatures(this.state.selectedFilters);
    const nextSignatures = canonicalFilterSignatures(filters);

    // Claim ownership only for a field this call actually changed (added, or a different value/operator
    // than before) -- not every field present in `filters`, which is AttributeDistribution's full,
    // controlled list and also includes fields it absorbed as "external" (page-set) that the sidebar
    // itself never touched. Claiming those too would make the sidebar rewrite them on every future
    // call below, ignoring later page-level edits to the same field.
    const nextSidebarFilterKeys = new Set(previousSidebarFilterKeys);
    for (const [field, signature] of nextSignatures) {
      if (previousSignatures.get(field) !== signature) {
        nextSidebarFilterKeys.add(field);
      }
    }
    // Release ownership for any previously-owned field no longer present at all (removed via this UI).
    for (const field of [...nextSidebarFilterKeys]) {
      if (!nextSignatures.has(field)) {
        nextSidebarFilterKeys.delete(field);
      }
    }
    this._sidebarFilterKeys = nextSidebarFilterKeys;

    this.setState({ selectedFilters: filters });

    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!isAdHocFiltersVariable(filtersVar)) {
      return;
    }

    // Every field whose value/operator signature actually changed this call, not just currently- or
    // previously-owned ones: a field the sidebar never owned (a pre-existing page filter, absorbed as
    // "external") can still be fully deselected via this UI. Since it's absent from `filters` entirely,
    // the claim loop above never visits it (it only iterates nextSignatures), so without this it would
    // never be recognized as changed at all, and its stale VAR_FILTERS entry would survive untouched.
    const changedFilterKeys = [...previousSignatures.keys()].filter(
      (field) => previousSignatures.get(field) !== nextSignatures.get(field)
    );
    // Union of previously-owned, newly-owned, and changed keys, not just the final owned set: a field
    // fully deselected drops out of the final _sidebarFilterKeys above, so filtering by that set alone
    // would reclassify its old VAR_FILTERS entry as "not ours" on the next line and write it straight
    // back in, silently undoing the removal (and making it impossible to deselect a pre-existing page
    // filter from this UI).
    const releasedOrOwnedKeys = new Set([...previousSidebarFilterKeys, ...this._sidebarFilterKeys, ...changedFilterKeys]);
    const otherFilters = filtersVar.state.filters.filter((f) => !releasedOrOwnedKeys.has(f.key));
    // Only the fields this sidebar currently owns, not the full `filters` list: an unclaimed field is
    // already correctly present in filtersVar untouched (that's exactly why it wasn't claimed above),
    // so re-adding it here too would duplicate its matcher alongside the untouched copy in otherFilters.
    const sidebarFilters = groupFiltersByFieldAndOperator(filters.filter((f) => this._sidebarFilterKeys.has(f.field))).map(
      ({ field, operator, values }) => {
        if (values.length === 1) {
          return { key: field, operator, value: values[0] };
        }
        const alternation = values.map(escapeAdHocRegexValue).join('|');
        return { key: field, operator: operator === '=' ? '=~' : '!~', value: alternation };
      }
    );

    filtersVar.setState({ filters: [...otherFilters, ...sidebarFilters] });
  }

  public static readonly Component = ({ model }: SceneComponentProps<AttributeExplorerScene>) => {
    const {
      attributeKinds,
      attributeLabels,
      datasourceUid,
      metric,
      metricType,
      otelPriorityReady,
      priorityAttributes,
      query,
      selectedFilters,
      timeRange,
    } = model.useState();
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const { histogramRange } = metricScene.useState();
    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;
    const styles = useStyles2(getStyles, chromeHeaderHeight);

    // The Attribute Explorer only supports histogram metrics (see PrometheusAttributeExplorerProps).
    // This also narrows metricType to HistogramMetricType for the JSX below via isHistogramWithThreshold's
    // type predicate, so the prop type-checks without a separate cast.
    if (!datasourceUid || !query || !isHistogramWithThreshold(metricType)) {
      return null;
    }

    return (
      <div className={styles.container} data-testid="attribute-explorer-content">
        <IconButton
          className={styles.closeButton}
          name="times"
          aria-label={t('attribute-explorer.close-aria-label', 'Close')}
          tooltip={t('attribute-explorer.close-tooltip', 'Close')}
          tooltipPlacement="top"
          onClick={() => metricScene.toggleAttributeExplorer()}
        />
        {/* Gates only the very first mount, before any detection has ever settled: otelPriorityReady
        never resets to false afterward, so a routine refresh updates priorityAttributes/
        attributeLabels/attributeKinds in place without unmounting this. */}
        {otelPriorityReady && (
          <PrometheusAttributeExplorer
            attributeKinds={attributeKinds}
            attributeLabels={attributeLabels}
            datasourceUid={datasourceUid}
            histogramRange={histogramRange}
            metric={metric}
            metricType={metricType}
            onFiltersChange={(filters) => model.handleFiltersChange(filters)}
            onHistogramRangeChange={(range) => metricScene.setHistogramRange(range)}
            priorityAttributes={priorityAttributes}
            query={query}
            selectedFilters={selectedFilters}
            timeRange={timeRange}
            colorBars={true}
          />
        )}
      </div>
    );
  };
}

// Regex metacharacters only; PromQL string-literal quoting happens at variable interpolation.
function escapeAdHocRegexValue(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    // Fixed against the viewport (not a DOM ancestor) so height isn't limited by MetricGraphScene's
    // own content height. No border/background here; AttributeDistribution renders its own panel.
    container: css({
      bottom: 0,
      boxSizing: 'border-box',
      position: 'fixed',
      right: 0,
      top: `calc(var(--app-controls-height, 0px) + ${chromeHeaderHeight}px)`,
      width: '300px',
      zIndex: 20,
    }),
    // Aligned with AttributeDistribution's own header padding so it sits on the title row.
    closeButton: css({
      position: 'absolute',
      right: theme.spacing(2),
      top: theme.spacing(2),
      zIndex: 1,
    }),
  };
}
