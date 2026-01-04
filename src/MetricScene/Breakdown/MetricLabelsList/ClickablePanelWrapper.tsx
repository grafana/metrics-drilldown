import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState, type VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

interface ClickablePanelWrapperState extends SceneObjectState {
  panel: VizPanel;
  navigationUrl: string;
  title?: string;
}

export class ClickablePanelWrapper extends SceneObjectBase<ClickablePanelWrapperState> {
  public static readonly Component = ({ model }: SceneComponentProps<ClickablePanelWrapper>) => {
    const { panel, navigationUrl, title } = model.useState();
    const styles = useStyles2(getStyles);

    const handleClick = () => {
      locationService.push(navigationUrl);
    };

    return (
      <div className={styles.container} onClick={handleClick} title={title}>
        <panel.Component model={panel} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      width: 100%;
      height: 100%;
      position: relative;
      cursor: pointer;
      &:hover {
        background: ${theme.colors.background.secondary};
      }
      /* Invisible overlay covering entire panel - z-index ensures it's above panel content */
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        cursor: inherit;
        z-index: 1;
      }
    `,
  };
}

