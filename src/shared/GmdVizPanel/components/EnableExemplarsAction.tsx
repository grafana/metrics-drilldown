import { LoadingState } from '@grafana/data';
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

interface EnableExemplarsActionState extends SceneObjectState {
  checked: boolean;
  disabled: boolean;
  dataStatus: DataStatus;
}

// Exemplars are only defined by the OpenMetrics spec for Counter, Histogram, and GaugeHistogram
// metric types, and only render as markers on a Grafana core timeseries panel (see ExemplarsPlugin
// in grafana/grafana). A metric can be the right type and still have no real exemplar data for the
// current time range, which this component can only learn after a query actually runs, so the
// tooltip reflects that outcome rather than looking identically "on" whether or not anything happened.
// See docs/exemplars-to-traces-drilldown-plan.md.
export class EnableExemplarsAction extends SceneObjectBase<EnableExemplarsActionState> {
  private _dataSub?: { unsubscribe: () => void };

  constructor() {
    super({
      checked: false,
      disabled: true,
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
    const checked = Boolean(queryConfig.exemplarsEnabled);

    this.setState({
      checked,
      disabled: !metricTypeResolved || metricType === 'gauge' || !rendersAsTimeseries,
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

    this._dataSub = queryRunner.subscribeToState((runnerState) => {
      if (runnerState.data?.state !== LoadingState.Done) {
        return;
      }
      const hasExemplars = (runnerState.data.annotations ?? []).some((frame) => frame.length > 0);
      this.setState({ dataStatus: hasExemplars ? 'has-data' : 'empty' });
    });
    this._subs.add(this._dataSub);
  }

  private onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const exemplarsEnabled = event.currentTarget.checked;

    reportExploreMetrics('exemplars_toggle_changed', { enabled: exemplarsEnabled });

    sceneGraph.getAncestor(this, GmdVizPanel).update({}, { exemplarsEnabled });
  };

  public static readonly Component = ({ model }: SceneComponentProps<EnableExemplarsAction>) => {
    const { checked, disabled, dataStatus } = model.useState();

    const label = t('gmd-viz-panel.enable-exemplars', 'Show exemplars');

    return (
      <Tooltip content={getTooltip(checked, disabled, dataStatus)} placement="top">
        <Switch
          value={checked}
          disabled={disabled}
          onChange={model.onChange}
          label={label}
          data-testid="enable-exemplars-action"
          data-status={dataStatus}
        />
      </Tooltip>
    );
  };
}

export function getTooltip(checked: boolean, disabled: boolean, dataStatus: DataStatus): string {
  if (disabled) {
    return t('gmd-viz-panel.enable-exemplars.unavailable', "Exemplars aren't available for this metric");
  }
  if (!checked) {
    return t('gmd-viz-panel.enable-exemplars.off', 'Show exemplars (counters and histograms only)');
  }
  if (dataStatus === 'empty') {
    return t('gmd-viz-panel.enable-exemplars.empty', 'No exemplars found for this metric in the current time range');
  }
  return t('gmd-viz-panel.enable-exemplars.on', 'Showing exemplars');
}
