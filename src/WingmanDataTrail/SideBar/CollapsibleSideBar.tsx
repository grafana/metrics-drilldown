import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';

interface CollapsibleSideBarState extends SceneObjectState {
  isCollapsed: boolean;
}

export class CollapsibleSideBar extends SceneObjectBase<CollapsibleSideBarState> {
  constructor(state: Partial<CollapsibleSideBarState>) {
    super({
      ...state,
      key: 'collapsible-sidebar',
      isCollapsed: true,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {}

  public static Component = ({ model }: SceneComponentProps<CollapsibleSideBar>) => {
    const styles = useStyles2(getStyles);
    const { key, isCollapsed } = model.useState();

    return (
      <div className={cx(styles.container, isCollapsed && styles.collapsed)} data-testid={key}>
        <div className={styles.header}>
          <Button
            className={styles.iconButton}
            size="md"
            variant="secondary"
            fill="text"
            icon={isCollapsed ? 'arrow-right' : 'arrow-left'}
            tooltip={isCollapsed ? 'Expand' : 'Collapse'}
            tooltipPlacement="top"
            onClick={() => model.setState({ isCollapsed: !isCollapsed })}
          />
        </div>
        <ul className={styles.featuresList}>
          <li className={cx(styles.featureItem, 'featureItem')}>
            <IconButton className={styles.iconButton} name="filter" aria-label="View filters" onClick={() => {}} />
            <div className={cx(styles.featureName, 'featureName')}>Filters</div>
          </li>
          <li className={cx(styles.featureItem, 'featureItem')}>
            <IconButton className={styles.iconButton} name="filter" aria-label="View filters" onClick={() => {}} />
            <div className={cx(styles.featureName, 'featureName')}>Labels</div>
          </li>
          <li className={cx(styles.featureItem, 'featureItem')}>
            <IconButton className={styles.iconButton} name="favorite" aria-label="View filters" onClick={() => {}} />
            <div className={cx(styles.featureName, 'featureName')}>Favorites</div>
          </li>
        </ul>
        {!isCollapsed && (
          <div className={styles.body}>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>Metric prefix filters</div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>Categories filters</div>
            </div>
          </div>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      width: 320px;
      height: 100%;
      padding: 0;
      position: relative;
      background-color: ${theme.colors.background.secondary};
      border: 1px solid none;
      border-radius: ${theme.shape.radius.default};
      padding: ${theme.spacing(2)};
    `,
    collapsed: css`
      width: 42px;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;

      .featureItem {
        margin-bottom: 0;
      }
      .featureName {
        display: none;
        opacity: 0;
        pointer-events: none;
      }
    `,
    header: css`
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin: 0;
    `,
    iconButton: css`
      margin: 0;
      color: ${theme.colors.text.secondary};

      &:hover {
        color: ${theme.colors.text.maxContrast};
        background: transparent;
      }
    `,
    featuresList: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: ${theme.spacing(1)};
      list-style: none;
      margin: 0;
      padding: 0;
    `,
    featureItem: css`
      display: flex;
      align-items: center;
      width: 100%;
      height: 32px;
      margin-bottom: ${theme.spacing(3)};
      font-weight: ${theme.typography.fontWeightBold};
    `,
    featureName: css`
      margin-left: ${theme.spacing(1)};
      transition: opacity 0.6s ease;
    `,
    body: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(2)};
    `,
    section: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(2)};
      margin-bottom: ${theme.spacing(2)};
    `,
    sectionHeader: css`
      padding-bottom: ${theme.spacing(1)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      margin-bottom: ${theme.spacing(1)};
    `,
  };
}
