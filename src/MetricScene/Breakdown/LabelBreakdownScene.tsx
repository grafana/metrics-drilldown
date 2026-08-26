import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  sceneGraph,
  SceneObjectBase,
  type QueryVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Field, useStyles2 } from '@grafana/ui';
import React from 'react';

import { GmdVizPanel, type HistogramBreakdownFn } from 'shared/GmdVizPanel/GmdVizPanel';
import { type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { getTrailFor } from 'shared/utils/utils';
import { getAppBackgroundColor } from 'shared/utils/utils.styles';

import { type HistogramBreakdownFnVariable } from './HistogramBreakdownFnVariable';
import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { MetricLabelValuesList } from './MetricLabelValuesList/MetricLabelValuesList';
import { actionViews } from '../../MetricScene/MetricActionBar';
import { RefreshMetricsEvent, VAR_GROUP_BY, VAR_HISTOGRAM_BREAKDOWN_FN } from '../../shared/shared';
import { isQueryVariable } from '../../shared/utils/utils.variables';
import { MetricScene } from '../MetricScene';
import { signalOnQueryComplete } from '../utils/signalOnQueryComplete';

interface LabelBreakdownSceneState extends SceneObjectState {
  metric: string;
  metricType: MetricType;
  body?: MetricLabelsList | MetricLabelValuesList;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  constructor({ metric }: { metric: LabelBreakdownSceneState['metric'] }) {
    super({
      metric,
      metricType: 'gauge',
      body: undefined,
      $behaviors: [new behaviors.SceneQueryController()],
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const groupByVariable = this.getVariable();

    groupByVariable.subscribeToState((newState, oldState) => {
      if (newState.value !== oldState.value) {
        this.updateBody(groupByVariable);
      }
    });

    this.getHistogramBreakdownFnVariable().subscribeToState((newState, oldState) => {
      if (newState.value !== oldState.value) {
        reportExploreMetrics('histogram_breakdown_fn_changed', { fn: newState.value as HistogramBreakdownFn });
        this.updateBody(groupByVariable);
      }
    });

    if (config.featureToggles.enableScopesInMetricsExplore) {
      this.subscribeToEvent(RefreshMetricsEvent, () => {
        this.updateBody(groupByVariable);
      });
    }

    this.subscribeToMainPanelMetricType(groupByVariable);
  }

  private getVariable(): QueryVariable {
    const groupByVariable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!isQueryVariable(groupByVariable)) {
      throw new Error('Group by variable not found');
    }
    return groupByVariable;
  }

  private getHistogramBreakdownFnVariable(): HistogramBreakdownFnVariable {
    return sceneGraph.lookupVariable(VAR_HISTOGRAM_BREAKDOWN_FN, this) as HistogramBreakdownFnVariable;
  }

  // Reuses the main graph panel's own resolved metric type instead of re-deriving it from metadata alone.
  private getMainPanel(): GmdVizPanel | undefined {
    const metricScene = sceneGraph.getAncestor(this, MetricScene);
    return sceneGraph.findDescendents(metricScene.state.body, GmdVizPanel)[0];
  }

  private subscribeToMainPanelMetricType(groupByVariable: QueryVariable) {
    const mainPanel = this.getMainPanel();

    this.updateBody(groupByVariable);

    if (!mainPanel) {
      return;
    }

    this._subs.add(
      mainPanel.subscribeToState((newState, prevState) => {
        if (
          newState.metricType !== prevState.metricType ||
          newState.metricTypeResolved !== prevState.metricTypeResolved
        ) {
          this.updateBody(this.getVariable());
        }
      })
    );
  }

  // metricType is a fast sync guess until metricTypeResolved flips true; building the body before then
  // would briefly query with the wrong function. Wait here -- the mainPanel subscription above re-triggers
  // this once it resolves, for whichever call site got skipped.
  private updateBody(groupByVariable: QueryVariable) {
    const mainPanel = this.getMainPanel();
    if (mainPanel && !mainPanel.state.metricTypeResolved) {
      return;
    }

    const { metric: name } = this.state;
    const trail = getTrailFor(this);
    const type: MetricType = mainPanel?.state.metricType ?? 'gauge';

    const metric = { name, type };
    // See MetricLabelValuesList's constructor for why this is passed explicitly instead of looked up there.
    const histogramBreakdownFn = this.getHistogramBreakdownFnVariable().state.value as HistogramBreakdownFn | undefined;

    const newBody = groupByVariable.hasAllValue()
      ? new MetricLabelsList({ metric })
      : new MetricLabelValuesList({
          metric,
          label: groupByVariable.state.value as string,
          binaryQuery: trail.state.binaryQuery,
          histogramBreakdownFn,
        });

    this.setState({ body: newBody, metricType: type });

    // Wait for body activation, then signal when queries complete
    if (newBody.isActive) {
      signalOnQueryComplete(this, actionViews.breakdown);
    } else {
      newBody.addActivationHandler(() => {
        signalOnQueryComplete(this, actionViews.breakdown);
      });
    }
  }

  public static readonly Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const chromeHeaderHeight = useChromeHeaderHeight();
    const trail = getTrailFor(model);
    const { embeddedMini } = trail.state;
    const styles = useStyles2(getStyles, trail.state.embedded ? 0 : (chromeHeaderHeight ?? 0));
    const { body, metricType } = model.useState();
    const groupByVariable = model.getVariable();
    const histogramBreakdownFnVariable = model.getHistogramBreakdownFnVariable();
    const isHistogram = metricType === 'classic-histogram' || metricType === 'native-histogram';

    return (
      <div className={styles.container}>
        {!embeddedMini && (
          <div className={styles.stickyControls} data-testid="breakdown-controls">
            <div className={styles.controls}>
              <div className={styles.leftControls}>
                <groupByVariable.Component model={groupByVariable} />
                {isHistogram && (
                  <Field label={t('breakdown.histogram-fn.label', 'Histogram function')} className={styles.field}>
                    <histogramBreakdownFnVariable.Component model={histogramBreakdownFnVariable} />
                  </Field>
                )}
              </div>
              {body instanceof MetricLabelsList && <body.Controls model={body} />}
              {body instanceof MetricLabelValuesList && <body.Controls model={body} />}
            </div>
          </div>
        )}
        {embeddedMini && <div className={styles.miniSectionLabel}>{t('breakdown.section-label', 'Breakdown')}</div>}
        <div data-testid="panels-list">
          {body instanceof MetricLabelsList && <body.Component model={body} />}
          {body instanceof MetricLabelValuesList && <body.Component model={body} />}
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, headerHeight: number) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    stickyControls: css({
      margin: theme.spacing(1, 0, 1.5, 0),
      position: 'sticky',
      top: `calc(var(--app-controls-height, 0px) + ${headerHeight}px + var(--action-bar-height, 0px))`,
      zIndex: 10,
      backgroundColor: getAppBackgroundColor(theme),
      paddingBottom: theme.spacing(1),
    }),
    controls: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'end',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    }),
    leftControls: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'end',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    }),
    field: css({
      marginBottom: 0,
    }),
    searchField: css({
      flexGrow: 1,
    }),
    miniSectionLabel: css({
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }),
  };
}
