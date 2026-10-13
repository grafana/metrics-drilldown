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
import React from 'react';

import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { reportExploreMetrics } from 'shared/tracking/interactions';

type DataStatus = 'unknown' | 'empty' | 'has-data';
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

    const supportsMetricType = metricType === 'counter' || metricType === 'classic-histogram' || metricType === 'native-histogram';
    const rendersAsTimeseries = panelConfig.type === 'timeseries' || panelConfig.type === 'percentiles';

    let disabledReason: DisabledReason = null;
    if (!metricTypeResolved || !supportsMetricType) {
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
    const checkData = (data: PanelData | undefined) => {
      if (data?.state !== LoadingState.Done) {
        return;
      }
      const hasExemplars = (data.annotations ?? []).some((frame) => frame.length > 0);
      this.setState({ dataStatus: hasExemplars ? 'has-data' : 'empty' });
    };

    checkData(queryRunner.state.data);
    this._dataSub = queryRunner.subscribeToState((runnerState) => checkData(runnerState.data));
    this._subs.add(this._dataSub);
  }

  private onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const exemplarsEnabled = event.currentTarget.checked;

    reportExploreMetrics('exemplars_toggle_changed', { enabled: exemplarsEnabled });

    sceneGraph.getAncestor(this, GmdVizPanel).update({}, { exemplarsEnabled });
  };

  public static readonly Component = ({ model }: SceneComponentProps<EnableExemplarsAction>) => {
    const { checked, disabledReason, dataStatus } = model.useState();

    const label = t('gmd-viz-panel.enable-exemplars.label', 'Show exemplars');

    return (
      <Tooltip content={getTooltip(checked, disabledReason, dataStatus)} placement="top">
        {/* Tooltip attaches its hover/focus handlers to this element. Switch forwards unrecognized
            props to its native, visually hidden <input> (opacity: 0, offscreen z-index), so putting
            the Tooltip directly on Switch would attach those handlers to an element the pointer
            never actually lands on; the visible surface is a sibling <label>. Wrapping in a plain
            span gives Tooltip a real hoverable target that contains that visible label. */}
        <span>
          <Switch
            value={checked}
            disabled={disabledReason !== null}
            onChange={model.onChange}
            label={label}
            data-testid="enable-exemplars-action"
            data-status={dataStatus}
          />
        </span>
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
  if (dataStatus === 'empty') {
    return t('gmd-viz-panel.enable-exemplars.empty', 'No exemplars found for this metric in the current time range');
  }
  return t('gmd-viz-panel.enable-exemplars.on', 'Showing exemplars');
}
