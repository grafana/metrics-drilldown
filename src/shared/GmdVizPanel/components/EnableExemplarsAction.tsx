import { LoadingState, type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Switch, Tooltip } from '@grafana/ui';
import React, { forwardRef } from 'react';

import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { supportsExemplars } from 'shared/GmdVizPanel/matchers/supportsExemplars';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { getTrailFor } from 'shared/utils/utils';

// Tooltip clones its child with tabIndex={0} and its hover/focus handlers. The handlers must land on this span
// (the switch's own hidden <input> is never under the pointer), but the tab stop should not: an enabled
// switch is already focusable, so honoring the injected tabIndex would add a second stop in front of it.
// A disabled <input> can't take focus, so only then does the span need to be the stop.
const TooltipTrigger = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { focusable: boolean }>(
  ({ focusable, tabIndex, ...rest }, ref) => <span ref={ref} tabIndex={focusable ? tabIndex : undefined} {...rest} />
);
TooltipTrigger.displayName = 'TooltipTrigger';

type DataStatus = 'unknown' | 'empty' | 'has-data' | 'error';
type DisabledReason = 'metric-type' | 'panel-type' | null;

interface EnableExemplarsActionState extends SceneObjectState {
  checked: boolean;
  disabledReason: DisabledReason;
  dataStatus: DataStatus;
}

// OpenMetrics defines exemplars only for Counter, Histogram, and GaugeHistogram metric types.
// Grafana's core heatmap panel can render exemplars too, but this app's heatmap query builder
// doesn't attach the exemplar flag yet, so a histogram still shown as a heatmap stays disabled
// here (see 'panel-type' below) even though its metric type would otherwise qualify.
export class EnableExemplarsAction extends SceneObjectBase<EnableExemplarsActionState> {
  private _dataSub?: { unsubscribe: () => void };

  constructor() {
    super({
      checked: false,
      disabledReason: 'metric-type',
      dataStatus: 'unknown',
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private onActivate() {
    const vizPanel = sceneGraph.getAncestor(this, GmdVizPanel);

    this.syncFromPanel(vizPanel);

    this._subs.add(
      vizPanel.subscribeToState((newState, prevState) => {
        if (
          newState.metricType !== prevState.metricType ||
          newState.metricTypeResolved !== prevState.metricTypeResolved ||
          newState.panelConfig.type !== prevState.panelConfig.type ||
          newState.queryConfig.exemplarsEnabled !== prevState.queryConfig.exemplarsEnabled ||
          newState.body !== prevState.body
        ) {
          this.syncFromPanel(vizPanel);
        }
      })
    );
  }

  private syncFromPanel(vizPanel: GmdVizPanel) {
    const { metricType, metricTypeResolved, panelConfig, queryConfig, body } = vizPanel.state;

    const rendersAsTimeseries = panelConfig.type === 'timeseries' || panelConfig.type === 'percentiles';

    let disabledReason: DisabledReason = null;
    if (!metricTypeResolved || !supportsExemplars(metricType)) {
      disabledReason = 'metric-type';
    } else if (!rendersAsTimeseries) {
      disabledReason = 'panel-type';
    }

    const checked = Boolean(queryConfig.exemplarsEnabled);

    this.setState({
      checked,
      disabledReason,
      dataStatus: 'unknown',
    });

    this._dataSub?.unsubscribe();
    this._dataSub = undefined;

    if (!checked || !body) {
      return;
    }

    const [queryRunner] = sceneGraph.findDescendents(body as SceneObject, SceneQueryRunner);
    if (!queryRunner) {
      return;
    }

    // Checked once immediately, in addition to subscribing: subscribeToState only fires on
    // subsequent state changes, not the value already present at subscribe time, so a query that
    // finished before this ran (e.g. the panel rebuilt with exemplarsEnabled already true) would
    // otherwise leave dataStatus stuck at 'unknown'.
    // A failed run reports 'error', and any other non-Done state (a new run starting) resets to
    // 'unknown', so the tooltip never shows the previous run's result against the current query.
    const checkData = (data: PanelData | undefined) => {
      let dataStatus: DataStatus = 'unknown';
      if (data?.state === LoadingState.Error) {
        dataStatus = 'error';
      } else if (data?.state === LoadingState.Done) {
        dataStatus = (data.annotations ?? []).some((frame) => frame.length > 0) ? 'has-data' : 'empty';
      }
      if (dataStatus !== this.state.dataStatus) {
        this.setState({ dataStatus });
      }
    };

    checkData(queryRunner.state.data);
    this._dataSub = queryRunner.subscribeToState((runnerState) => checkData(runnerState.data));
    this._subs.add(this._dataSub);
  }

  private onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const exemplarsEnabled = event.currentTarget.checked;

    reportExploreMetrics('exemplars_toggle_changed', { enabled: exemplarsEnabled });

    // DataTrail owns the state (it is synced with the url); MetricGraphScene pushes it into the panel.
    getTrailFor(this).setState({ exemplarsEnabled });
  };

  public static readonly Component = ({ model }: SceneComponentProps<EnableExemplarsAction>) => {
    const { checked, disabledReason, dataStatus } = model.useState();

    const label = t('gmd-viz-panel.enable-exemplars.label', 'Show exemplars');
    const tooltip = getTooltip(checked, disabledReason, dataStatus);
    const isDisabled = disabledReason !== null;

    return (
      <Tooltip content={tooltip} placement="top">
        {/* While disabled, the span is the keyboard stop and carries the reason as its accessible name
            (equal to the tooltip text, so Tooltip doesn't announce it twice). */}
        <TooltipTrigger
          focusable={isDisabled}
          role={isDisabled ? 'group' : undefined}
          aria-label={isDisabled ? tooltip : undefined}
        >
          <Switch
            value={checked}
            disabled={isDisabled}
            onChange={model.onChange}
            label={label}
            data-testid="enable-exemplars-action"
            data-status={dataStatus}
          />
        </TooltipTrigger>
      </Tooltip>
    );
  };
}

export function getTooltip(checked: boolean, disabledReason: DisabledReason, dataStatus: DataStatus): string {
  if (disabledReason === 'metric-type') {
    return t('gmd-viz-panel.enable-exemplars.unavailable', "Exemplars aren't available for this metric");
  }
  if (disabledReason === 'panel-type') {
    return t('gmd-viz-panel.enable-exemplars.switch-to-percentiles', 'Switch to the Percentiles view to show exemplars');
  }
  if (!checked) {
    return t('gmd-viz-panel.enable-exemplars.off', 'Show exemplars (counters and histograms only)');
  }
  if (dataStatus === 'error') {
    return t('gmd-viz-panel.enable-exemplars.error', "Exemplars couldn't be loaded because the query failed");
  }
  if (dataStatus === 'empty') {
    return t('gmd-viz-panel.enable-exemplars.empty', 'No exemplars found for this metric in the current time range');
  }
  return t('gmd-viz-panel.enable-exemplars.on', 'Showing exemplars');
}
