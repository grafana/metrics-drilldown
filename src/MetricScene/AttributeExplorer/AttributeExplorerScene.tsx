
import { css } from '@emotion/css';
import { getDefaultTimeRange, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useChromeHeaderHeight } from '@grafana/runtime';
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

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { getMetricTypeSync, type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { VAR_DATASOURCE, VAR_FILTERS, VAR_METRIC } from 'shared/shared';
import { isAdHocFiltersVariable } from 'shared/utils/utils.variables';

import { type ActiveFilter } from './attributeDistributionState';
import { groupFiltersByFieldAndOperator, PrometheusAttributeExplorer } from './PrometheusAttributeExplorer';
import { MetricScene } from '../MetricScene';

interface AttributeExplorerSceneState extends SceneObjectState {
  datasourceUid: string;
  query: string;
  selectedFilters: ActiveFilter[];
  timeRange: TimeRange;
}

export class AttributeExplorerScene extends SceneObjectBase<AttributeExplorerSceneState> {
  // Fields the sidebar itself has written into VAR_FILTERS. Used to avoid clobbering filters set by
  // other page surfaces (Breakdown tab clicks, manual filter bar edits) when writing our own
  // selections back, and to avoid re-expanding our own collapsed multi-value regex filters into
  // individual values on the next sync (ambiguous with a user-typed regex on the same field) --
  // known mistake class, see project_errors_explorer_filter_scoping in memory.
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

  public constructor() {
    super({
      key: 'attribute-explorer',
      datasourceUid: '',
      query: '',
      selectedFilters: [],
      timeRange: getDefaultTimeRange(),
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    this._updateQueryAndDatasource();
    this._syncSelectedFiltersFromVar();

    const timeRangeObj = sceneGraph.getTimeRange(this);
    this.setState({ timeRange: timeRangeObj.state.value });
    this._subs.add(
      timeRangeObj.subscribeToState((newState) => {
        this.setState({ timeRange: newState.value });
      })
    );
  }

  private _updateQueryAndDatasource() {
    const metric = sceneGraph.lookupVariable(VAR_METRIC, this)?.getValue()?.toString() ?? '';
    if (!metric) {
      return;
    }
    // buildQueryExpression only reads metric.name, not metric.type -- getMetricTypeSync's return type
    // (Omit<MetricType, 'native-histogram'>) is a subset of the concrete MetricType string values, so
    // this cast is safe; it just doesn't structurally match Metric.type's declared union.
    const expression = buildQueryExpression({
      metric: { name: metric, type: getMetricTypeSync(metric) as MetricType },
    });
    const query = sceneGraph.interpolate(this, expression);

    const dsVariable = sceneGraph.lookupVariable(VAR_DATASOURCE, this);
    const datasourceUid = (dsVariable?.getValue()?.toString() ?? '') as string;

    this.setState({ datasourceUid, query });
  }

  private _syncSelectedFiltersFromVar() {
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!isAdHocFiltersVariable(filtersVar)) {
      return;
    }

    const stillPresentKeys = new Set(filtersVar.state.filters.map((f) => f.key));
    // Keep our own current selections for fields we own AND that still have a corresponding entry in
    // VAR_FILTERS (an external removal, e.g. deleting the chip from the page filter bar, clears it).
    // Do NOT re-derive these from VAR_FILTERS: a sidebar-authored multi-value selection is collapsed
    // into a single =~/!~ regex entry there, and expanding that regex back into individual values
    // would be ambiguous with a user-typed regex on the same field.
    const ours = this.state.selectedFilters.filter(
      (f) => this._sidebarFilterKeys.has(f.field) && stillPresentKeys.has(f.field)
    );

    // Fields we don't own: pick up plain =/!= filters set by some other page surface, so a
    // pre-existing page filter shows as already-selected if it happens to match a discovered
    // attribute. Regex filters (=~/!~) on fields we don't own are not representable by ActiveFilter
    // and are left alone -- they simply won't show as selected in the sidebar.
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

  // Persistent toggle panel opened via MetricGraphScene's "Explore Attributes" CTA. Show/hide is
  // controlled by MetricScene.attributeExplorerOpen, but the panel still needs its own in-place close
  // button -- once open, the CTA that opened it is no longer the only affordance a user expects to
  // dismiss it with.
  public static readonly Component = ({ model }: SceneComponentProps<AttributeExplorerScene>) => {
    const { datasourceUid, query, selectedFilters, timeRange } = model.useState();
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    // MetricGraphScene's own container only grows to its CONTENT's height (a flex item with
    // flexGrow:1 sized by its children, not forced to viewport height), so position:absolute against
    // it only reaches that content's bottom, not the visual bottom of the page -- the panel rendered
    // short with dead space below it that it structurally could not reach. Fixed positioning against
    // the real viewport, offset below Grafana's chrome via the same hook MetricGraphScene itself uses
    // for this exact purpose, sidesteps that entirely.
    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;
    const styles = useStyles2(getStyles, chromeHeaderHeight);

    if (!datasourceUid || !query) {
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
        <PrometheusAttributeExplorer
          datasourceUid={datasourceUid}
          onFiltersChange={(filters) => model.handleFiltersChange(filters)}
          query={query}
          selectedFilters={selectedFilters}
          timeRange={timeRange}
          colorBars={true}
        />
      </div>
    );
  };
}

// AdHocVariableFilter values are not PromQL string literals, so only regex metacharacters need
// escaping here (no quote/backslash string-escaping) -- the variable interpolation layer applies the
// PromQL string-literal quoting when the query is built from it.
function escapeAdHocRegexValue(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    // Pure positioning layer -- fixed against the real browser viewport, not a DOM ancestor, so it
    // spans full page height regardless of how tall MetricGraphScene's own content happens to be.
    // `top` clears Grafana's global chrome + app-controls, same calc MetricGraphScene's own stickyTop
    // uses. zIndex above MetricActionBar's sticky tab bar (zIndex: 10). Deliberately draws no border,
    // padding, or background of its own: AttributeDistribution renders its own bordered, padded panel
    // that fills this wrapper, so styling here too would produce a panel-inside-a-panel double border.
    container: css({
      bottom: 0,
      boxSizing: 'border-box',
      position: 'fixed',
      right: 0,
      top: `calc(var(--app-controls-height, 0px) + ${chromeHeaderHeight}px)`,
      width: '300px',
      zIndex: 20,
    }),
    // Pinned into the top-right corner of AttributeDistribution's own header padding (padding: 2),
    // so it aligns with the "Attribute Explorer" title row instead of floating over the panel border.
    closeButton: css({
      position: 'absolute',
      right: theme.spacing(2),
      top: theme.spacing(2),
      zIndex: 1,
    }),
  };
}
