import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_WINGMAN_GROUP_BY } from 'WingmanDataTrail/Labels/LabelsVariable';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import { computeMetricSuffixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricSuffixGroups';
import { computeRulesGroups } from 'WingmanDataTrail/MetricsVariables/computeRulesGroups';

import { BookmarksList } from './sections/BookmarksList';
import { LabelsBrowser } from './sections/LabelsBrowser';
import { MetricsFilterSection } from './sections/MetricsFilterSection/MetricsFilterSection';
import { Settings } from './sections/Settings';

type Section = MetricsFilterSection | LabelsBrowser | BookmarksList | Settings;

interface SideBarState extends SceneObjectState {
  sections: Section[];
  visibleSection: Section | null;
}

export class SideBar extends SceneObjectBase<SideBarState> {
  constructor(state: Partial<SideBarState>) {
    super({
      key: 'sidebar',
      visibleSection: null,
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
          description: 'Filter metrics based on their name prefix (Prometheus namespace)',
          iconName: 'filter',
          computeGroups: computeMetricPrefixGroups,
        }),
        // TEMP
        new MetricsFilterSection({
          key: 'suffix-filters',
          type: 'suffixes',
          title: 'Suffix filters',
          description: 'Filter metrics based on their name suffix',
          iconName: 'filter',
          computeGroups: computeMetricSuffixGroups,
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
    const { visibleSection, sections } = this.state;

    if (!sectionKey || sectionKey === visibleSection?.state.key) {
      this.setState({ visibleSection: null });
      return;
    }

    this.setState({
      visibleSection: sections.find((section) => section.state.key === sectionKey) ?? null,
    });
  }

  public static Component = ({ model }: SceneComponentProps<SideBar>) => {
    const styles = useStyles2(getStyles);
    const { sections, visibleSection } = model.useState();

    return (
      <div className={styles.container}>
        <div className={styles.buttonsBar}>
          {sections.map((section) => {
            const { key, title, iconName, disabled, active } = section.state;
            const isVisible = visibleSection?.state.key === key;

            return (
              <div
                key={key}
                className={cx(
                  styles.buttonContainer,
                  isVisible && 'visible',
                  active && 'active',
                  disabled && 'disabled'
                )}
              >
                <Button
                  className={cx(styles.button, disabled && 'disabled', isVisible && 'visible', active && 'active')}
                  size="md"
                  variant="secondary"
                  fill="text"
                  icon={iconName}
                  aria-label={title}
                  tooltip={title}
                  tooltipPlacement="right"
                  onClick={() => model.setActiveSection(key)}
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>
        {visibleSection && (
          <div className={styles.content}>
            <IconButton
              className={styles.closeButton}
              name="times"
              aria-label="Close"
              tooltip="Close"
              tooltipPlacement="top"
              onClick={() => model.setActiveSection('')}
            />
            {/* :man_shrug: */}
            {visibleSection instanceof MetricsFilterSection && <visibleSection.Component model={visibleSection} />}
            {visibleSection instanceof LabelsBrowser && <visibleSection.Component model={visibleSection} />}
            {visibleSection instanceof BookmarksList && <visibleSection.Component model={visibleSection} />}
            {visibleSection instanceof Settings && <visibleSection.Component model={visibleSection} />}
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
      position: 'relative',
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
      '&.visible::before': {
        opacity: 1,
        visibility: 'visible',
      },
      '&.disabled::before': {
        opacity: 0,
        visibility: 'hidden',
      },
      '&.active::after': {
        content: '""',
        position: 'absolute',
        right: 0,
        width: '8px',
        height: '8px',
        backgroundColor: theme.colors.action.selectedBorder,
        borderRadius: '50%',
        margin: '2px 5px 0 0',
      },
    }),
    button: css({
      margin: 0,
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.maxContrast,
        background: 'transparent',
      },
      '&.disabled:hover': {
        color: theme.colors.text.secondary,
      },
      '&.visible': {
        color: theme.colors.text.maxContrast,
      },
      '&.active': {
        color: theme.colors.text.maxContrast,
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
