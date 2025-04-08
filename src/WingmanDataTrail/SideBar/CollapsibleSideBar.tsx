import { css, cx } from '@emotion/css';
import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, CollapsableSection, Icon, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { PluginLogo } from 'PluginInfo/PluginLogo';
import { VAR_WINGMAN_GROUP_BY } from 'WingmanDataTrail/Labels/LabelsVariable';
import { computeMetricCategories } from 'WingmanDataTrail/MetricsVariables/computeMetricCategories';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import { computeRulesGroups } from 'WingmanDataTrail/MetricsVariables/computeRulesGroups';
import { LabelsBrowser } from 'WingmanDataTrail/SideBar/LabelsBrowser';

import { MetricsFilterSection } from './SceneMetricsFilterSection';

interface CollapsibleSideBarState extends SceneObjectState {
  isCollapsed: boolean;
  groupFilters: MetricsFilterSection[];
  labelBrowser: LabelsBrowser;
}

export class CollapsibleSideBar extends SceneObjectBase<CollapsibleSideBarState> {
  constructor(state: Partial<CollapsibleSideBarState>) {
    super({
      ...state,
      key: 'collapsible-sidebar',
      isCollapsed: true,
      groupFilters: [
        new MetricsFilterSection({
          title: 'Rules filters',
          type: 'categories',
          computeGroups: computeRulesGroups,
        }),
        new MetricsFilterSection({
          title: 'Prefix filters',
          type: 'prefixes',
          computeGroups: computeMetricPrefixGroups,
        }),
        new MetricsFilterSection({
          title: 'Suffix filters',
          type: 'categories',
          computeGroups: computeMetricCategories, // TODO
        }),
      ],
      labelBrowser: new LabelsBrowser({
        labelVariableName: VAR_WINGMAN_GROUP_BY,
      }),
    });
  }

  public static Component = ({ model }: SceneComponentProps<CollapsibleSideBar>) => {
    const styles = useStyles2(getStyles);
    const { key, isCollapsed, groupFilters, labelBrowser } = model.useState();
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

    const toggleSidebar = (iconType: string) => {
      if (iconType === 'toggle') {
        model.setState({ isCollapsed: !isCollapsed });
        return;
      }

      if (isCollapsed) {
        setOpenSections({ [iconType]: !openSections[iconType] });
        model.setState({ isCollapsed: !isCollapsed });
      }
    };

    const toggleSection = (section: string) => {
      setOpenSections({ ...openSections, [section]: !openSections[section] });
    };

    return (
      <div className={cx(styles.container, isCollapsed && styles.collapsed)} data-testid={key}>
        <div className={cx(styles.header, 'header')}>
          <div className={cx(styles.title, 'title')}>
            <PluginLogo size="small" />
            <span>Drilldown options</span>
          </div>
          <Button
            className={cx(styles.iconButton, 'expand-collapse')}
            size="md"
            variant="secondary"
            fill="text"
            icon={isCollapsed ? 'arrow-right' : 'arrow-left'}
            tooltip={isCollapsed ? 'Expand' : 'Collapse'}
            tooltipPlacement="right"
            onClick={() => toggleSidebar('toggle')}
          />
        </div>
        <ul className={styles.featuresList}>
          {groupFilters.map((filter) => {
            const icon: IconName = filter.state.title === 'Rules filters' ? 'record-audio' : 'filter';

            return (
              <li key={filter.state.key} className={cx(styles.featureItem, 'featureItem')}>
                {isCollapsed && (
                  <Button
                    className={styles.iconButton}
                    size="md"
                    variant="secondary"
                    fill="text"
                    icon={icon}
                    tooltip={isCollapsed ? filter.state.title : ''}
                    tooltipPlacement="right"
                    onClick={() => toggleSidebar(filter.state.key)}
                  />
                )}
                {!isCollapsed && (
                  <CollapsableSection
                    key={filter.state.key}
                    className={styles.collapsable}
                    label={
                      <div className={styles.featureLabel}>
                        <Icon name={icon} size="md" className={styles.icon} />
                        <span>{filter.state.title}</span>
                      </div>
                    }
                    isOpen={openSections[filter.state.key]}
                    onToggle={() => toggleSection(filter.state.key)}
                  >
                    <filter.Component model={filter} />
                  </CollapsableSection>
                )}
              </li>
            );
          })}
          <li className={cx(styles.featureItem, 'featureItem')}>
            {isCollapsed && (
              <Button
                className={styles.iconButton}
                size="md"
                variant="secondary"
                fill="text"
                icon="gf-prometheus"
                tooltip={isCollapsed ? 'Group by labels' : ''}
                tooltipPlacement="right"
                onClick={() => toggleSidebar(labelBrowser.state.key)}
              />
            )}
            {!isCollapsed && (
              <CollapsableSection
                className={styles.collapsable}
                label={
                  <div className={styles.featureLabel}>
                    <Icon name="gf-prometheus" size="md" className={styles.icon} />
                    <span>Group by labels</span>
                  </div>
                }
                isOpen={openSections[labelBrowser.state.key]}
                onToggle={() => toggleSection(labelBrowser.state.key)}
              >
                <labelBrowser.Component model={labelBrowser} />
              </CollapsableSection>
            )}
          </li>
          <li className={cx(styles.featureItem, 'featureItem')}>
            {isCollapsed && (
              <Button
                className={styles.iconButton}
                size="md"
                variant="secondary"
                fill="text"
                icon="bookmark"
                tooltip={isCollapsed ? 'Bookmarks' : ''}
                tooltipPlacement="right"
                onClick={() => toggleSidebar('bookmarks')}
              />
            )}
            {!isCollapsed && (
              <CollapsableSection
                className={styles.collapsable}
                label={
                  <div className={styles.featureLabel}>
                    <Icon name="bookmark" size="md" className={styles.icon} />
                    <span>Bookmarks</span>
                  </div>
                }
                isOpen={openSections['bookmarks']}
                onToggle={() => toggleSection('bookmarks')}
              >
                <></>
              </CollapsableSection>
            )}
          </li>
        </ul>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      width: 320px;
      height: 100%;
      position: relative;
      padding: ${theme.spacing(2)};
    `,
    collapsed: css`
      width: 42px;

      .title,
      .featureLabel {
        display: none;
      }
      .header {
        justify-content: center;
      }
      .featureItem {
        justify-content: center;
        width: auto;

        border-bottom: none;
      }
      .featureItem:hover {
        & button::before {
          background: transparent;
        }
      }
      .featureItem:hover::before {
        opacity: 1;
        visibility: unset;
        & button::before {
          background: transparent;
        }
      }
    `,
    header: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin: ${theme.spacing(0, 0, 2, 0)};
    `,
    title: css`
      font-size: 16px;
    `,
    iconButton: css`
      margin: 0;
      &:hover {
        color: ${theme.colors.text.maxContrast};
        background: transparent;
      }
      &.expand-collapse {
        padding: ${theme.spacing(1)};
      }
    `,
    featuresList: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1.25)};
      align-items: center;
      list-style: none;
      margin: 0;
      padding: 0;
    `,
    featureItem: css`
      display: flex;
      flex-direction: column;
      width: 100%;
      &::before {
        transition: 0.5s ease;
        content: '';
        position: absolute;
        left: 0;
        height: 42px;
        border-left: 2px solid ${theme.colors.action.selectedBorder};
        opacity: 0;
        visibility: hidden;
      }
      &:not(:last-child) {
        border-bottom: 1px solid ${theme.colors.border.weak};
      }
      & [id^='collapse-content'] {
        padding: 0 !important;
        margin-top: ${theme.spacing(1)};
      }
    `,
    featureLabel: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
      height: 32px;
    `,
    icon: css`
      color: ${theme.colors.text.secondary};
    `,
    collapsable: css`
      font-size: 14px;
      padding: 0;
      margin: 0;
      &:focus-within {
        box-shadow: none !important;
      }
    `,
    showPreview: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
      justify-content: space-between;
    `,
  };
}
