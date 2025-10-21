import { css, cx } from '@emotion/css';
import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  VizPanel,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { type Panel } from '@grafana/schema';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { getPanelData } from './addToDashboard/addToDashboard';

const extensionPointId = 'grafana/app/panel/menu'; // TODO: Use `PluginExtensionPoints.AppPanelMenu` when it becomes available

interface AddToDashboardActionState extends SceneObjectState {}

// TODO: Import this type from `@grafana/data` when it becomes available
interface PluginExtensionAppPanelContext {
  // Panel configuration
  panelData?: { panel: Panel; range: TimeRange };
  // Source information
  source?: { appId: string; appName: string };
}

export class AddToDashboardAction extends SceneObjectBase<AddToDashboardActionState> {
  constructor() {
    super({});
  }

  public static readonly Component = ({ model }: SceneComponentProps<AddToDashboardAction>) => {
    const styles = useStyles2(getStyles);

    // Find the VizPanel in the scene graph
    const vizPanel = sceneGraph.findObject(model, (o) => o instanceof VizPanel);

    // Get panel data for context (only if vizPanel exists)
    const panelData = vizPanel instanceof VizPanel ? getPanelData(vizPanel) : undefined;

    // Provide context with panel data and source information
    const context: PluginExtensionAppPanelContext = {
      panelData,
      source: {
        appId: 'grafana-metricsdrilldown-app',
        appName: 'Grafana Metrics Drilldown',
      },
    };

    // Get the add-to-dashboard extension link from Grafana core
    const { links } = usePluginLinks({ extensionPointId, context, limitPerPlugin: 1 });
    const link = links[0];

    // Don't render if no extension link is available
    if (!link) {
      return null;
    }

    const label = link.description || 'Add to dashboard';

    return (
      <Button
        className={cx(styles.button)}
        aria-label={label}
        variant="secondary"
        size="sm"
        fill="text"
        onClick={(e) => {
          if (link.onClick) {
            link.onClick(e);
          }
        }}
        icon={link.icon || 'apps'}
        tooltip={label}
        tooltipPlacement="top"
        data-testid="add-to-dashboard-action"
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
