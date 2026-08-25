
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

interface AttributeExplorerSceneState extends SceneObjectState {
  // Which OTel pass matched each priority attribute ('metric' vs 'resource'), so the sidebar can show
  // an accurate, specific reason per attribute instead of one caption for the whole priority group.
  attributeKinds: Record<string, 'metric' | 'resource'>;
  attributeLabels: Record<string, string>;
  datasourceUid: string;
  metric: string;
  metricType: MetricType;
  // False while OTel-shape detection is in flight for the current query. The explorer stays unmounted
  // until true, since AttributeDistribution reads priorityAttributes once and won't reorder if it
  // arrives late.
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
      } else {
        this._updateQueryAndDatasource();
      }
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

    fetchDefaultLowerThreshold(context).subscribe((lowerSeconds) => {
      if (generation !== this._histogramSeedGeneration || lowerSeconds === undefined) {
        return;
      }
      // Re-checked at resolution time, not just at request time: a user could have typed an explicit
      // value while this query was in flight, which must win over a seed arriving after the fact.
      if (metricScene.state.histogramRange === undefined) {
        metricScene.setHistogramRange({ lowerSeconds: Number(lowerSeconds.toPrecision(2)), upperSeconds: Number.POSITIVE_INFINITY });
      }
    });
  }

  private _resolveOtelPriority(datasourceUid: string, query: string) {
    const generation = ++this._otelPriorityGeneration;
    this.setState({ attributeKinds: {}, attributeLabels: {}, otelPriorityReady: false, priorityAttributes: [] });

    if (!datasourceUid || !query) {
      this.setState({ otelPriorityReady: true });
      return;
    }

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
    this._sidebarFilterKeys = new Set(filters.map((f) => f.field));
    this.setState({ selectedFilters: filters });

    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!isAdHocFiltersVariable(filtersVar)) {
      return;
    }

    const otherFilters = filtersVar.state.filters.filter((f) => !this._sidebarFilterKeys.has(f.key));
    const sidebarFilters = groupFiltersByFieldAndOperator(filters).map(({ field, operator, values }) => {
      if (values.length === 1) {
        return { key: field, operator, value: values[0] };
      }
      const alternation = values.map(escapeAdHocRegexValue).join('|');
      return { key: field, operator: operator === '=' ? '=~' : '!~', value: alternation };
    });

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
