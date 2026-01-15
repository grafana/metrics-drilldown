import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { usePluginFunctions } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  VizPanel,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { logger } from 'shared/logger/logger';

// Function signature type
type CreateAlertFromPanelFn = (options: {
  panel: VizPanel;
  openInNewTab?: boolean;
}) => Promise<{
  success: boolean;
  url?: string;
  error?: string;
}>;

// Use string literal until new @grafana/data is released
const EXTENSION_POINT_ID = 'grafana/alerting/create-alert-from-panel/v1';
const CREATE_ALERT_LABEL = 'Create alert';

interface CreateAlertActionState extends SceneObjectState {}

export class CreateAlertAction extends SceneObjectBase<CreateAlertActionState> {
  constructor() {
    super({});
  }

  public static readonly Component = ({ model }: SceneComponentProps<CreateAlertAction>) => {
    const styles = useStyles2(getStyles);

    // Find the VizPanel in the scene graph
    const vizPanel = sceneGraph.findObject(model, (o) => o instanceof VizPanel) as VizPanel | undefined;

    const { functions, isLoading } = usePluginFunctions<CreateAlertFromPanelFn>({
      extensionPointId: EXTENSION_POINT_ID,
    });

    // Don't render if loading, no functions available, or no vizPanel
    if (isLoading || functions.length === 0 || !vizPanel) {
      return null;
    }

    const handleClick = async () => {
      const createAlertFn = functions[0];

      if (!createAlertFn) {
        logger.error(new Error('Create alert function not available'));
        return;
      }

      const result = await createAlertFn.fn({ panel: vizPanel, openInNewTab: true });

      if (!result.success) {
        logger.error(new Error('Failed to create alert: ' + result.error));
      }
    };

    return (
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
