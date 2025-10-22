import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneObjectBase, VizPanel, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { getTrailFor } from 'shared/utils/utils';

import { getPanelData } from './addToDashboard/addToDashboard';
import { EventOpenAddToDashboard } from './addToDashboard/EventOpenAddToDashboard';

interface AddToDashboardActionState extends SceneObjectState {}

export class AddToDashboardAction extends SceneObjectBase<AddToDashboardActionState> {
  constructor() {
    super({});
  }

  public static readonly Component = ({ model }: SceneComponentProps<AddToDashboardAction>) => {
    const styles = useStyles2(getStyles);

    // Get the DataTrail to check if add to dashboard component is available
    const trail = getTrailFor(model);

    // Find the VizPanel in the scene graph
    const vizPanel = sceneGraph.findObject(model, (o) => o instanceof VizPanel);
    
    // Get panel data for context (only if vizPanel exists)
    const panelData = vizPanel instanceof VizPanel ? getPanelData(vizPanel) : undefined;

    // Don't render if component is not available or no panel data
    if (!trail.state.isAddToDashboardAvailable || !panelData) {
      return null;
    }

    return (
      <Button
        className={cx(styles.button)}
        aria-label={"Add to dashboard"}
        variant="secondary"
        size="sm"
        fill="text"
        onClick={() => {
          model.publishEvent(new EventOpenAddToDashboard({ panelData }), true);
        }}
        icon={'apps'}
        tooltip={"Add to dashboard"}
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

