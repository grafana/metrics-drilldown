import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_WINGMAN_GROUP_BY } from 'WingmanDataTrail/Labels/LabelsVariable';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import { computeRulesGroups } from 'WingmanDataTrail/MetricsVariables/computeRulesGroups';

import { BookmarksList } from './sections/BookmarksList';
import { LabelsBrowser } from './sections/LabelsBrowser';
import { MetricsFilterSection } from './sections/MetricsFilterSection/MetricsFilterSection';
import { Settings } from './sections/Settings';

type Section = MetricsFilterSection | LabelsBrowser | BookmarksList | Settings;

interface SideBarState extends SceneObjectState {
  sections: Section[];
  activeSection: Section | null;
}

export class SideBar extends SceneObjectBase<SideBarState> {
  constructor(state: Partial<SideBarState>) {
    super({
      key: 'sidebar',
      activeSection: null,
      sections: [
        new MetricsFilterSection({
          key: 'rule-filters',
          type: 'categories',
          title: 'Rules filters',
          description: 'Filter metrics, recording rules and alerting rules',
          iconName: 'record-audio',
          computeGroups: computeRulesGroups,
          showHideEmpty: false,
          showSearch: false,
        }),
        new MetricsFilterSection({
          key: 'prefix-filters',
          type: 'prefixes',
          title: 'Prefix filters',
          description: 'Filter metrics based on their name prefix',
          iconName: 'filter',
          computeGroups: computeMetricPrefixGroups,
        }),
        // TEMP
        new MetricsFilterSection({
          key: 'suffix-filters',
          type: 'prefixes',
          title: 'Suffix filters',
          description: 'Filter metrics based on their name suffix',
          iconName: 'filter',
          computeGroups: computeMetricPrefixGroups,
        }),
        new LabelsBrowser({
          key: 'groupby-labels',
          variableName: VAR_WINGMAN_GROUP_BY,
          title: 'Group by labels',
          description: 'Group metrics by their label values',
          iconName: 'gf-prometheus',
        }),
        new BookmarksList({
          key: 'bookmarks',
          title: 'Bookmarks',
          description: 'Bookmarks',
          iconName: 'bookmark',
          disabled: true,
        }),
        new Settings({
          key: 'settings',
          title: 'Settings',
          description: 'Settings',
          iconName: 'cog',
          disabled: true,
        }),
      ],
      ...state,
    });
  }

  public setActiveSection(sectionKey: string) {
    const { activeSection, sections } = this.state;

    if (!sectionKey || sectionKey === activeSection?.state.key) {
      this.setState({ activeSection: null });
      return;
    }

    this.setState({
      activeSection: sections.find((section) => section.state.key === sectionKey) ?? null,
    });
  }

  public static Component = ({ model }: SceneComponentProps<SideBar>) => {
    const styles = useStyles2(getStyles);
    const { sections, activeSection } = model.useState();

    return (
      <div className={styles.container}>
        <div className={styles.buttonsBar}>
          {sections.map((section) => (
            <div
              key={section.state.key}
              className={cx(
                styles.buttonContainer,
                activeSection?.state.key === section.state.key && 'active',
                section.state.disabled && 'disabled'
              )}
            >
              <Button
                className={cx(styles.button, section.state.disabled && 'disabled')}
                size="md"
                variant="secondary"
                fill="text"
                icon={section.state.iconName}
                aria-label={section.state.title}
                tooltip={section.state.title}
                tooltipPlacement="right"
                onClick={() => model.setActiveSection(section.state.key)}
                disabled={section.state.disabled}
              />
            </div>
          ))}
        </div>
        {activeSection && (
          <div className={styles.content}>
            <IconButton
              className={styles.closeButton}
              name="times"
              aria-label="Close"
              tooltip="Close"
              tooltipPlacement="top"
              onClick={() => model.setActiveSection('')}
            />
            {activeSection && <activeSection.Component model={activeSection as any} />}
          </div>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      overflow: 'hidden',
    }),
    buttonsBar: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      width: '42px',
      padding: 0,
      margin: 0,
      boxSizing: 'border-box',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.primary,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    }),
    buttonContainer: css({
      marginTop: theme.spacing(1),
      '&::before': {
        transition: '0.5s ease',
        content: '""',
        position: 'absolute',
        left: 0,
        height: '32px',
        borderLeft: `2px solid ${theme.colors.action.selectedBorder}`,
        boxSizing: 'border-box',
        opacity: 0,
        visibility: 'hidden',
      },
      '&:hover::before': {
        opacity: 1,
        visibility: 'visible',
      },
      '&.active::before': {
        opacity: 1,
        visibility: 'visible',
      },
      '&.disabled::before': {
        opacity: 0,
        visibility: 'hidden',
      },
    }),
    button: css({
      margin: 0,
      '&:hover': {
        color: theme.colors.text.maxContrast,
        background: 'transparent',
      },
      '&.disabled:hover': {
        color: theme.colors.text.secondary,
      },
    }),
    content: css({
      width: 'calc(300px - 42px)', // we want 300px in total
      boxSizing: 'border-box',
      border: `1px solid ${theme.colors.border.weak}`,
      borderLeft: 'none',
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.canvas,
      padding: theme.spacing(1.5),
    }),
    closeButton: css({
      position: 'absolute',
      top: theme.spacing(1.5),
      right: theme.spacing(1),
      margin: 0,
    }),
  };
}

export default SideBar;
