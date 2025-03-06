import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

interface ShowMorePanelState extends SceneObjectState {
  onClick?: () => void;
}

export class ShowMorePanel extends SceneObjectBase<ShowMorePanelState> {
  constructor(state: Partial<ShowMorePanelState>) {
    super({
      ...state,
      key: 'show-more-panel',
    });
  }

  public static Component = ({ model }: SceneComponentProps<ShowMorePanel>) => {
    const styles = useStyles2(getStyles);
    const { onClick } = model.state;

    return (
      <div className={styles.panelContainer} onClick={() => onClick?.()}>
        <div className={styles.content}>
          <div className={styles.showMoreText}>
            Show More&nbsp;<i className="fa fa-caret-down"></i>
          </div>
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    panelContainer: css({
      height: '240px', // fix this in the future
      width: '100%',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(),
      display: 'flex',
      cursor: 'pointer',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z1,
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        background: theme.colors.background.primary,
        boxShadow: theme.shadows.z2,
      },
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      padding: theme.spacing(2),
    }),
    showMoreText: css({
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    }),
  };
}
