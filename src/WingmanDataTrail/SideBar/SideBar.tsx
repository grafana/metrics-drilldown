import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';

import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { VAR_WINGMAN_GROUP_BY } from 'WingmanDataTrail/Labels/LabelsVariable';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import { computeMetricSuffixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricSuffixGroups';
import { computeRulesGroups } from 'WingmanDataTrail/MetricsVariables/computeRulesGroups';

import { BookmarksList } from './sections/BookmarksList';
import { EventSectionValueChanged } from './sections/EventSectionValueChanged';
import { LabelsBrowser } from './sections/LabelsBrowser';
import { MetricsFilterSection } from './sections/MetricsFilterSection/MetricsFilterSection';
import { Settings } from './sections/Settings';
import { SideBarButton } from './SideBarButton';

type Section = MetricsFilterSection | LabelsBrowser | BookmarksList | Settings;

interface SideBarState extends SceneObjectState {
  sections: Section[];
  visibleSection: Section | null;
  sectionValues: Map<string, string[]>;
}

export class SideBar extends SceneObjectBase<SideBarState> {
  constructor(state: Partial<SideBarState>) {
    const sectionValues = SideBar.getSectionValuesFromUrl();

    super({
      key: 'sidebar',
      visibleSection: null,
      sections: [
        new MetricsFilterSection({
          key: 'filters-rule',
          type: 'categories',
          title: 'Rules filters',
          description: 'Filter metrics, recording rules and alerting rules',
          icon: 'rules',
          computeGroups: computeRulesGroups,
          showHideEmpty: false,
          showSearch: false,
          active: Boolean(sectionValues.get('filters-rule')?.length),
        }),
        new MetricsFilterSection({
          key: 'filters-prefix',
          type: 'prefixes',
          title: 'Prefix filters',
          description: 'Filter metrics based on their name prefix (Prometheus namespace)',
          icon: 'A_',
          computeGroups: computeMetricPrefixGroups,
          active: Boolean(sectionValues.get('filters-prefix')?.length),
        }),
        new MetricsFilterSection({
          key: 'filters-suffix',
          type: 'suffixes',
          title: 'Suffix filters',
          description: 'Filter metrics based on their name suffix',
          icon: '_Z',
          computeGroups: computeMetricSuffixGroups,
          active: Boolean(sectionValues.get('filters-suffix')?.length),
        }),
        new LabelsBrowser({
          key: 'groupby-labels',
          variableName: VAR_WINGMAN_GROUP_BY,
          title: 'Group by labels',
          description: 'Group metrics by their label values',
          icon: 'groups',
          active: sectionValues.has('groupby-labels'),
        }),
        new BookmarksList({
          key: 'bookmarks',
          title: 'Bookmarks',
          description: 'Bookmarks',
          icon: 'bookmark',
          disabled: true,
        }),
        new Settings({
          key: 'settings',
          title: 'Settings',
          description: 'Settings',
          icon: 'cog',
          disabled: true,
        }),
      ],
      sectionValues,
      ...state,
    });

    // TODO: FIXME
    // rule values are regexes, we do this only to disable adding the values to the button tooltip
    sectionValues.set('filters-rule', []);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this._subs.add(
      this.subscribeToEvent(EventSectionValueChanged, (event) => {
        const { key, values } = event.payload;
        const { sectionValues } = this.state;

        this.setState({ sectionValues: new Map(sectionValues).set(key, values) });
      })
    );
  }

  private static getSectionValuesFromUrl() {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const sectionValues = new Map();

    for (const filterKey of ['filters-rule', 'filters-prefix', 'filters-suffix']) {
      const filterValueFromUrl = urlSearchParams.get(filterKey);
      sectionValues.set(filterKey, filterValueFromUrl ? filterValueFromUrl.split(',').map((v) => v.trim()) : []);
    }

    const labelValue = urlSearchParams.get(`var-${VAR_WINGMAN_GROUP_BY}`);
    const isLabelsBrowserActive = Boolean(labelValue && labelValue !== NULL_GROUP_BY_VALUE);
    if (isLabelsBrowserActive) {
      sectionValues.set('groupby-labels', [labelValue!]);
    }

    return sectionValues;
  }

  private setActiveSection(sectionKey: string) {
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
    const { sections, visibleSection, sectionValues } = model.useState();

    return (
      <div className={styles.container}>
        <div className={styles.buttonsBar} data-testid="sidebar-buttons">
          {sections.map((section) => {
            const { key, title, icon: iconOrText, disabled, active } = section.state;
            const visible = visibleSection?.state.key === key;
            const tooltip = sectionValues.get(key)?.length ? `${title}: ${sectionValues.get(key)?.join(', ')}` : title;

            return (
              <div
                key={key}
                className={cx(styles.buttonContainer, visible && 'visible', active && 'active', disabled && 'disabled')}
              >
                <SideBarButton
                  ariaLabel={title}
                  disabled={disabled}
                  visible={visible}
                  active={active}
                  tooltip={tooltip}
                  onClick={() => model.setActiveSection(key)}
                  iconOrText={iconOrText}
                />
              </div>
            );
          })}
        </div>
        {visibleSection && (
          <div className={styles.content} data-testid="sidebar-content">
            <IconButton
              className={styles.closeButton}
              name="times"
              aria-label="Close"
              tooltip="Close"
              tooltipPlacement="top"
              onClick={() => model.setActiveSection('')}
            />
            {/* TODO: find a better way */}
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
        margin: '2px 4px 0 0',
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
