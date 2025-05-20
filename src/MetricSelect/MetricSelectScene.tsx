// TODO: delete this file! It has been deprecated in favor of the MetricsReducer scene */
/* eslint-disable */

import { css } from '@emotion/css';
import { type AdHocVariableFilter, type GrafanaTheme2, type RawTimeRange, type SelectableValue } from '@grafana/data';
import { config, isFetchError } from '@grafana/runtime';
import {
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectStateChangedEvent,
  SceneObjectUrlSyncConfig,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneCSSGridItem,
  type SceneFlexItem,
  type SceneFlexLayout,
  type SceneObject,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneObjectUrlValues,
  type SceneObjectWithUrlSync,
} from '@grafana/scenes';
import { Alert, Combobox, Field, Icon, IconButton, Input, Tooltip, useStyles2 } from '@grafana/ui';
import { debounce, isEqual } from 'lodash';
import React, { useReducer, type SyntheticEvent } from 'react';

import { UI_TEXT } from 'constants/ui';

import { Parser, type Node } from '../groop/parser';
import { getMetricDescription } from '../helpers/MetricDatasourceHelper';
import { reportExploreMetrics } from '../interactions';
import { MetricScene } from '../MetricScene';
import { MetricSelectedEvent, RefreshMetricsEvent, VAR_DATASOURCE, VAR_DATASOURCE_EXPR, VAR_FILTERS } from '../shared';
import { StatusWrapper } from '../StatusWrapper';
import { getTrailFor } from '../utils';
import { getMetricNames } from './api';
import { getPreviewPanelFor } from './PreviewPanel';
import { sortRelatedMetrics } from './relatedMetrics';
import { createJSRegExpFromSearchTerms, createPromRegExp, deriveSearchTermsFromInput } from './util';
import { isSceneCSSGridLayout, isSceneFlexLayout } from '../utils/utils.layout';
import { getSelectedScopes } from '../utils/utils.scopes';
import { isSceneTimeRange, isSceneTimeRangeState } from '../utils/utils.timerange';
import { isAdHocFiltersVariable } from '../utils/utils.variables';
import { METRICS_VIZ_PANEL_HEIGHT } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

interface MetricPanel {
  name: string;
  index: number;
  itemRef?: SceneObjectRef<SceneCSSGridItem>;
  isEmpty?: boolean;
  isPanel?: boolean;
  loaded?: boolean;
}

export interface MetricSelectSceneState extends SceneObjectState {
  body: SceneFlexLayout | SceneCSSGridLayout;
  rootGroup?: Node;
  metricPrefix?: string;
  metricNames?: string[];
  metricNamesLoading?: boolean;
  metricNamesError?: string;
  metricNamesWarning?: string;
}

const METRIC_PREFIX_ALL = 'all';

const MAX_METRIC_NAMES = 20000;

const viewByTooltip =
  'View by the metric prefix. A metric prefix is a single word at the beginning of the metric name, relevant to the domain the metric belongs to.';

export class MetricSelectScene extends SceneObjectBase<MetricSelectSceneState> implements SceneObjectWithUrlSync {
  private previewCache: Record<string, MetricPanel> = {};
  private ignoreNextUpdate = false;
  private _debounceRefreshMetricNames = debounce(() => this._refreshMetricNames(), 1000);

  constructor(state: Partial<MetricSelectSceneState>) {
    super({
      $variables: state.$variables,
      metricPrefix: state.metricPrefix ?? METRIC_PREFIX_ALL,
      body:
        state.body ??
        new SceneCSSGridLayout({
          children: [],
          templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
          autoRows: METRICS_VIZ_PANEL_HEIGHT,
          isLazy: true,
        }),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metricPrefix'] });
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE],
    onReferencedVariableValueChanged: () => {
      // In all cases, we want to reload the metric names
      this._debounceRefreshMetricNames();
    },
  });

  getUrlState() {
    return { metricPrefix: this.state.metricPrefix };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.metricPrefix === 'string') {
      if (this.state.metricPrefix !== values.metricPrefix) {
        this.setState({ metricPrefix: values.metricPrefix });
      }
    }
  }

  private _onActivate() {
    if (this.state.body.state.children.length === 0) {
      this.buildLayout();
    } else {
      // Temp hack when going back to select metric scene and variable updates
      this.ignoreNextUpdate = true;
    }

    const trail = getTrailFor(this);

    this._subs.add(
      trail.subscribeToEvent(MetricSelectedEvent, (event) => {
        if (event.payload !== undefined) {
          const metricSearch = getMetricSearch(trail);
          const searchTermCount = deriveSearchTermsFromInput(metricSearch).length;

          reportExploreMetrics('metric_selected', {
            from: 'metric_list',
            // HISTORY: need way to identify selected metrics from related metrics
            // from: isRelatedMetricSelector ? 'related_metrics' : 'metric_list',
            searchTermCount,
          });
        }
      })
    );

    this._subs.add(
      trail.subscribeToEvent(SceneObjectStateChangedEvent, (evt) => {
        if (isSceneTimeRange(evt.payload.changedObject)) {
          const { prevState, newState } = evt.payload;

          if (isSceneTimeRangeState(prevState) && isSceneTimeRangeState(newState)) {
            if (prevState.from === newState.from && prevState.to === newState.to) {
              return;
            }
          }
        }
      })
    );

    this._subs.add(
      trail.subscribeToState(({ metricSearch }, oldState) => {
        const oldSearchTerms = deriveSearchTermsFromInput(oldState.metricSearch);
        const newSearchTerms = deriveSearchTermsFromInput(metricSearch);
        if (!isEqual(oldSearchTerms, newSearchTerms)) {
          this._debounceRefreshMetricNames();
        }
      })
    );

    this.subscribeToState((newState, prevState) => {
      if (newState.metricNames !== prevState.metricNames) {
        this.onMetricNamesChanged();
      }
    });

    this._subs.add(
      trail.subscribeToState(() => {
        // build layout when toggled
        this.buildLayout();
      })
    );

    if (config.featureToggles.enableScopesInMetricsExplore) {
      this._subs.add(
        trail.subscribeToEvent(RefreshMetricsEvent, () => {
          this._debounceRefreshMetricNames();
        })
      );
    }

    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (isAdHocFiltersVariable(filtersVariable)) {
      this._subs.add(
        filtersVariable?.subscribeToState((newState, prevState) => {
          // if oldState is not equal to newstate, then we need to refresh the metric names
          // this handles changes in __name__ labels which are filtered out of the expression in DataTrail.tsx
          if (!isEqual(prevState, newState)) {
            this._debounceRefreshMetricNames();
          }
        })
      );
    }

    this._debounceRefreshMetricNames();
  }

  private async _refreshMetricNames() {
    const trail = getTrailFor(this);
    const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;

    if (!timeRange) {
      return;
    }

    const filters: AdHocVariableFilter[] = [];

    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    const adhocFilters = isAdHocFiltersVariable(filtersVar) ? filtersVar?.state.filters ?? [] : [];
    if (adhocFilters.length > 0) {
      filters.push(...adhocFilters);
    }

    const metricSearchRegex = createPromRegExp(trail.state.metricSearch);
    if (metricSearchRegex) {
      filters.push({
        key: '__name__',
        operator: '=~',
        value: metricSearchRegex,
      });
    }

    const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
    this.setState({ metricNamesLoading: true, metricNamesError: undefined, metricNamesWarning: undefined });

    try {
      let jobsList: string[] = [];
      let instancesList: string[] = [];

      const response = await getMetricNames(
        datasourceUid,
        timeRange,
        getSelectedScopes(),
        filters,
        jobsList,
        instancesList,
        MAX_METRIC_NAMES
      );
      const searchRegex = createJSRegExpFromSearchTerms(getMetricSearch(this));
      let metricNames = searchRegex
        ? response.data.filter((metric: string) => !searchRegex || searchRegex.test(metric))
        : response.data;

      // use this to generate groups for metric prefix
      const filteredMetricNames = metricNames;

      // filter the remaining metrics with the metric prefix
      const metricPrefix = this.state.metricPrefix;
      if (metricPrefix && metricPrefix !== 'all') {
        const prefixRegex = new RegExp(`(^${metricPrefix}.*)`, 'igy');
        metricNames = metricNames.filter((metric: string) => !prefixRegex || prefixRegex.test(metric));
      }

      let metricNamesWarning = response.limitReached
        ? `This feature will only return up to ${MAX_METRIC_NAMES} metric names for performance reasons. ` +
          `This limit is being exceeded for the current data source. ` +
          `Add search terms or label filters to narrow down the number of metric names returned.`
        : undefined;

      let bodyLayout = this.state.body;

      // generate groups based on the search metrics input
      let rootGroupNode = await this.generateGroups(filteredMetricNames);

      this.setState({
        metricNames,
        rootGroup: rootGroupNode,
        body: bodyLayout,
        metricNamesLoading: false,
        metricNamesWarning,
        metricNamesError: response.error,
      });
    } catch (err: unknown) {
      let error = 'Unknown error';
      if (isFetchError(err)) {
        if (err.cancelled) {
          error = 'Request cancelled';
        } else if (err.statusText) {
          error = err.statusText;
        }
      }

      this.setState({ metricNames: undefined, metricNamesLoading: false, metricNamesError: error });
    }
  }

  private async generateGroups(metricNames: string[] = []) {
    const groopParser = new Parser();
    groopParser.config = {
      ...groopParser.config,
      maxDepth: 2,
      minGroupSize: 2,
      miscGroupKey: 'misc',
    };
    const { root: rootGroupNode } = groopParser.parse(metricNames);
    return rootGroupNode;
  }

  private onMetricNamesChanged() {
    const metricNames = this.state.metricNames || [];

    const nameSet = new Set(metricNames);

    Object.values(this.previewCache).forEach((panel) => {
      if (!nameSet.has(panel.name)) {
        panel.isEmpty = true;
      }
    });

    const trail = getTrailFor(this);
    const sortedMetricNames =
      trail.state.metric !== undefined ? sortRelatedMetrics(metricNames, trail.state.metric) : metricNames;
    const metricsMap: Record<string, MetricPanel> = {};
    const metricsLimit = 120;

    // Clear absent metrics from cache
    Object.keys(this.previewCache).forEach((metric) => {
      if (!nameSet.has(metric)) {
        delete this.previewCache[metric];
      }
    });

    for (let index = 0; index < sortedMetricNames.length; index++) {
      const metricName = sortedMetricNames[index];

      if (Object.keys(metricsMap).length > metricsLimit) {
        break;
      }

      const oldPanel = this.previewCache[metricName];

      metricsMap[metricName] = oldPanel || { name: metricName, index, loaded: false };
    }

    try {
      // If there is a current metric, do not present it
      const currentMetric = sceneGraph.getAncestor(this, MetricScene).state.metric;
      delete metricsMap[currentMetric];
    } catch {
      // There is no current metric
    }

    this.previewCache = metricsMap;
    this.buildLayout();
  }

  private sortedPreviewMetrics() {
    return Object.values(this.previewCache).sort((a, b) => {
      if (a.isEmpty && b.isEmpty) {
        return a.index - b.index;
      }
      if (a.isEmpty) {
        return 1;
      }
      if (b.isEmpty) {
        return -1;
      }
      return a.index - b.index;
    });
  }

  private async buildLayout() {
    const trail = getTrailFor(this);
    // Temp hack when going back to select metric scene and variable updates
    if (this.ignoreNextUpdate) {
      this.ignoreNextUpdate = false;
      return;
    }

    const children: SceneFlexItem[] = [];

    const metricsList = this.sortedPreviewMetrics();

    for (let index = 0; index < metricsList.length; index++) {
      const metric = metricsList[index];
      const metadata = await trail.getMetricMetadata(metric.name);
      const description = getMetricDescription(metadata);

      if (metric.itemRef && metric.isPanel) {
        children.push(metric.itemRef.resolve());
        continue;
      }
      // refactor this into the query generator in future
      const isNative = trail.isNativeHistogram(metric.name);
      const panel = getPreviewPanelFor(metric.name, index, false, description, isNative, true);
      metric.itemRef = panel.getRef();
      metric.isPanel = true;
      children.push(panel);
    }

    this.state.body.setState({ children, autoRows: METRICS_VIZ_PANEL_HEIGHT });
  }

  public updateMetricPanel = (metric: string, isLoaded?: boolean, isEmpty?: boolean) => {
    const metricPanel = this.previewCache[metric];
    if (metricPanel) {
      metricPanel.isEmpty = isEmpty;
      metricPanel.loaded = isLoaded;
      this.previewCache[metric] = metricPanel;
      if (this.state.metricPrefix === 'All') {
        this.buildLayout();
      }
    }
  };

  public onSearchQueryChange = (evt: SyntheticEvent<HTMLInputElement>) => {
    const metricSearch = evt.currentTarget.value;
    const trail = getTrailFor(this);
    // Update the variable
    trail.setState({ metricSearch });
  };

  public onPrefixFilterChange = (val: SelectableValue) => {
    this.setState({ metricPrefix: val.value });
    this._refreshMetricNames();
  };

  public reportPrefixFilterInteraction = (isMenuOpen: boolean) => {
    reportExploreMetrics('prefix_filter_clicked', {
      // HISTORY: need way to identify selected metrics from related metrics
      // from: isRelatedMetricSelector ? 'related_metrics' : 'metric_list',
      from: 'metric_list',
      action: isMenuOpen ? 'open' : 'close',
    });
  };

  public static readonly Component = ({ model }: SceneComponentProps<MetricSelectScene>) => {
    const { body, metricNames, metricNamesError, metricNamesLoading, metricNamesWarning, rootGroup, metricPrefix } =
      model.useState();
    const { children } = body.useState();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles);

    const [warningDismissed, dismissWarning] = useReducer(() => true, false);

    const { metricSearch } = trail.useState();

    const tooStrict = children.length === 0 && metricSearch;
    const noMetrics = !metricNamesLoading && metricNames && metricNames.length === 0;

    const isLoading = metricNamesLoading && children.length === 0;
    let blockingMessage;

    if (!isLoading) {
      blockingMessage = noMetrics
        ? 'There are no results found. Try a different time range or a different data source.'
        : tooStrict
        ? 'There are no results found. Try adjusting your search or filters.'
        : undefined;
    }

    const metricNamesWarningIcon = metricNamesWarning ? (
      <Tooltip
        content={
          <>
            <h4>Unable to retrieve metric names</h4>
            <p>{metricNamesWarning}</p>
          </>
        }
      >
        <Icon className={styles.warningIcon} name="exclamation-triangle" />
      </Tooltip>
    ) : undefined;

    return (
      <div className={styles.container} data-testid="scene">
        <div className={styles.header} data-testid="scene-header">
          <Field label={UI_TEXT.SEARCH.TITLE} className={styles.searchField}>
            <Input
              placeholder={UI_TEXT.SEARCH.TITLE}
              prefix={<Icon name={'search'} />}
              value={metricSearch}
              onChange={model.onSearchQueryChange}
              suffix={metricNamesWarningIcon}
            />
          </Field>
          <Field
            label={
              <div className={styles.displayOptionTooltip}>
                View by
                <IconButton name={'info-circle'} size="sm" variant={'secondary'} tooltip={viewByTooltip} />
              </div>
            }
            className={styles.displayOption}
          >
            <Combobox
              value={metricPrefix}
              onChange={(selected) => model.onPrefixFilterChange(selected)}
              options={[
                {
                  label: 'All metric names',
                  value: METRIC_PREFIX_ALL,
                },
                ...Array.from(rootGroup?.groups.keys() ?? []).map((g) => ({ label: `${g}_`, value: g })),
              ]}
              width={16}
            />
          </Field>
        </div>
        {metricNamesError && (
          <Alert title="Unable to retrieve metric names" severity="error">
            <div>We are unable to connect to your data source. Double check your data source URL and credentials.</div>
            <div>({metricNamesError})</div>
          </Alert>
        )}
        {metricNamesWarning && !warningDismissed && (
          <Alert
            title="Unable to retrieve all metric names"
            severity="warning"
            onSubmit={dismissWarning}
            onRemove={dismissWarning}
          >
            <div>{metricNamesWarning}</div>
          </Alert>
        )}
        <StatusWrapper {...{ isLoading, blockingMessage }}>
          <div data-testid="scene-body">
            {isSceneFlexLayout(body) && <body.Component model={body} />}
            {isSceneCSSGridLayout(body) && <body.Component model={body} />}
          </div>
        </StatusWrapper>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    headingWrapper: css({
      marginBottom: theme.spacing(0.5),
    }),
    header: css({
      flexGrow: 0,
      display: 'flex',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(2),
      alignItems: 'flex-end',
    }),
    searchField: css({
      flexGrow: 1,
      marginBottom: 0,
    }),
    metricTabGroup: css({
      marginBottom: theme.spacing(2),
    }),
    displayOption: css({
      flexGrow: 0,
      marginBottom: 0,
      minWidth: '184px',
    }),
    displayOptionTooltip: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
    warningIcon: css({
      color: theme.colors.warning.main,
    }),
    badgeStyle: css({
      display: 'flex',
      height: '1rem',
      padding: '0rem 0.25rem 0 0.30rem',
      alignItems: 'center',
      borderRadius: theme.shape.radius.pill,
      border: `1px solid ${theme.colors.warning.text}`,
      // badge color does not align with theme warning color so we explicitly set it here
      color: `${theme.colors.warning.text}`,
      background: theme.colors.info.transparent,
      marginTop: '4px',
      marginLeft: '-3px',
    }),
  };
}

function getMetricSearch(scene: SceneObject) {
  const trail = getTrailFor(scene);
  return trail.state.metricSearch || '';
}
