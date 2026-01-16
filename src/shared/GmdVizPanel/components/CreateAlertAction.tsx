import { css, cx } from '@emotion/css';
import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  VizPanel,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { type Panel } from '@grafana/schema';
import { Button, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { getPanelData, type PanelDataRequestPayload } from './addToDashboard/addToDashboard';

// NOTE: Until a new version of @grafana/data is released that includes
// PluginExtensionExposedComponents.CreateAlertFromPanelV1, use the string literal:
const CREATE_ALERT_COMPONENT_ID = 'grafana/alerting/create-alert-from-panel/v1';
const CREATE_ALERT_LABEL = 'Create alert';

interface CreateAlertActionState extends SceneObjectState {}

export class CreateAlertAction extends SceneObjectBase<CreateAlertActionState> {
  constructor() {
    super({});
  }

  public static readonly Component = ({ model }: SceneComponentProps<CreateAlertAction>) => {
    const styles = useStyles2(getStyles);
    const [showModal, setShowModal] = useState(false);
    const [panelData, setPanelData] = useState<PanelDataRequestPayload | null>(null);

    // Find the VizPanel in the scene graph
    const vizPanel = sceneGraph.findObject(model, (o) => o instanceof VizPanel) as VizPanel | undefined;

    const { component: CreateAlertModal, isLoading } = usePluginComponent<{
      panel: Panel;
      range: TimeRange;
      onDismiss: () => void;
    }>(CREATE_ALERT_COMPONENT_ID);

    // Don't render if loading, no component available, or no vizPanel
    if (isLoading || !CreateAlertModal || !vizPanel) {
      return null;
    }

    const handleClick = () => {
      // We use getPanelData to transform the VizPanel into a Panel schema object
      // with interpolated variables. This is required because plugin components
      // cannot receive scene objects directly - they need serializable data.
      const data = getPanelData(vizPanel);
      setPanelData(data);
      setShowModal(true);
    };

    return (
      <>
        <Button
          id="create-alert-action"
          className={cx(styles.button)}
          aria-label={CREATE_ALERT_LABEL}
          variant="secondary"
          size="sm"
          fill="text"
          onClick={handleClick}
          icon={'bell'}
          tooltip={CREATE_ALERT_LABEL}
          tooltipPlacement="top"
          data-testid="create-alert-action"
        />
        {showModal && panelData && (
          <CreateAlertModal panel={panelData.panel} range={panelData.range} onDismiss={() => setShowModal(false)} />
        )}
      </>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css`
    margin: 0;
    padding: 0;
    margin-left: ${theme.spacing(1)};
  `,
});
