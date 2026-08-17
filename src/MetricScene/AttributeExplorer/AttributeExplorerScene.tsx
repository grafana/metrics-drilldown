
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
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { VAR_DATASOURCE, VAR_FILTERS, VAR_METRIC } from 'shared/shared';
import { isAdHocFiltersVariable } from 'shared/utils/utils.variables';

import { type ActiveFilter } from './attributeDistributionState';
import { groupFiltersByFieldAndOperator, PrometheusAttributeExplorer } from './PrometheusAttributeExplorer';
import { MetricScene } from '../MetricScene';

interface AttributeExplorerSceneState extends SceneObjectState {
  datasourceUid: string;
  metricType: MetricType;
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

  public constructor() {
    super({
      key: 'attribute-explorer',
      datasourceUid: '',
      metricType: 'gauge',
      query: '',
      selectedFilters: [],
      timeRange: getDefaultTimeRange(),
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    this._resolveMetricType();
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

    this.setState({ datasourceUid, query });
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
    const { datasourceUid, metricType, query, selectedFilters, timeRange } = model.useState();
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
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
          metricType={metricType}
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

// Regex metacharacters only -- PromQL string-literal quoting happens at variable interpolation.
function escapeAdHocRegexValue(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    // Fixed against the viewport (not a DOM ancestor) so height isn't limited by MetricGraphScene's
    // own content height. No border/background here -- AttributeDistribution renders its own panel.
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
