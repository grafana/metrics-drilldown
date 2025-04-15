import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Dropdown, Switch, ToolbarButton, useStyles2 } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from './interactions';
import { MetricScene } from './MetricScene';
import { getTrailFor } from './utils';

export interface DataTrailSettingsState extends SceneObjectState {
  stickyMainGraph?: boolean;
  isOpen?: boolean;
}

export class DataTrailSettings extends SceneObjectBase<DataTrailSettingsState> {
  constructor(state: Partial<DataTrailSettingsState>) {
    super({
      stickyMainGraph: state.stickyMainGraph ?? true,
      isOpen: state.isOpen ?? false,
    });
  }

  public onToggleStickyMainGraph = () => {
    const stickyMainGraph = !this.state.stickyMainGraph;
    reportExploreMetrics('settings_changed', { stickyMainGraph });
    this.setState({ stickyMainGraph });
  };

  public onToggleOpen = (isOpen: boolean) => {
    this.setState({ isOpen });
    if (isOpen) {
      reportExploreMetrics('settings_opened', {});
    }
  };

  static Component = ({ model }: SceneComponentProps<DataTrailSettings>) => {
    const { stickyMainGraph, isOpen } = model.useState();
    const styles = useStyles2(getStyles);

    const trail = getTrailFor(model);
    const { topScene } = trail.useState();

    const isButtonEnabled = topScene instanceof MetricScene;

    const renderPopover = () => {
      return (
        <div className={styles.popover} onClick={(evt) => evt.stopPropagation()}>
          <div className={styles.heading}>Settings</div>
          {topScene instanceof MetricScene && (
            <div className={styles.options}>
              <div>Always keep selected metric graph in-view</div>
              <Switch value={stickyMainGraph} onChange={model.onToggleStickyMainGraph} />
            </div>
          )}
        </div>
      );
    };

    return (
      <Dropdown overlay={renderPopover} placement="bottom" onVisibleChange={model.onToggleOpen}>
        <ToolbarButton
          icon="cog"
          variant="canvas"
          isOpen={isOpen}
          data-testid="settings-button"
          disabled={!isButtonEnabled}
        />
      </Dropdown>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    popover: css({
      display: 'flex',
      padding: theme.spacing(2),
      flexDirection: 'column',
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      zIndex: 1,
      marginRight: theme.spacing(2),
    }),
    heading: css({
      fontWeight: theme.typography.fontWeightMedium,
      paddingBottom: theme.spacing(2),
    }),
    options: css({
      display: 'grid',
      gridTemplateColumns: '1fr 50px',
      rowGap: theme.spacing(1),
      columnGap: theme.spacing(2),
    }),
  };
}
