import { css, cx } from '@emotion/css';
import { VariableHide, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AdHocFiltersVariable,
  sceneGraph,
  SceneObjectBase,
  type AdHocFilterWithLabels,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';
import React from 'react';

import { NULL_GROUP_BY_VALUE } from 'MetricsReducer/labels/LabelsDataSource';
import { LabelsVariable, VAR_WINGMAN_GROUP_BY } from 'MetricsReducer/labels/LabelsVariable';
import { computeMetricPrefixGroups } from 'MetricsReducer/metrics-variables/computeMetricPrefixGroups';
import { computeMetricSuffixGroups } from 'MetricsReducer/metrics-variables/computeMetricSuffixGroups';
import { computeRulesGroups } from 'MetricsReducer/metrics-variables/computeRulesGroups';
import { evaluateFeatureFlag } from 'shared/featureFlags/openFeature';
import { VAR_OTHER_METRIC_FILTERS } from 'shared/shared';
import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';
import { embeddedTrailNamespace, getObjectValues, getTrailFor } from 'shared/utils/utils';
import { isAdHocFiltersVariable } from 'shared/utils/utils.variables';

import { BookmarksList } from './sections/BookmarksList/BookmarksList';
import { EventSectionValueChanged } from './sections/EventSectionValueChanged';
import { LabelsBrowser } from './sections/LabelsBrowser/LabelsBrowser';
import { MetricsFilterSection } from './sections/MetricsFilterSection/MetricsFilterSection';
import { RecentMetricsSection } from './sections/RecentMetricsSection/RecentMetricsSection';
import { Settings } from './sections/Settings';
import { SideBarButton } from './SideBarButton';
import { reportExploreMetrics } from '../../shared/tracking/interactions';

type Section = MetricsFilterSection | RecentMetricsSection | LabelsBrowser | BookmarksList | Settings;

interface SideBarState extends SceneObjectState {
  sections: Section[];
  visibleSection: Section | null;
  sectionValues: Map<string, string[]>;
}

function getTranslatedSectionInfo(key: string): { title: string; description: string } {
  const sectionMap: Record<string, { title: string; description: string }> = {
    'filters-rule': {
      title: t('sidebar.section.rules-filters', 'Rules filters'),
      description: t('sidebar.section.rules-filters-description', 'Filter metrics and recording rules'),
    },
    'filters-prefix': {
      title: t('sidebar.section.prefix-filters', 'Prefix filters'),
      description: t(
        'sidebar.section.prefix-filters-description',
        'Filter metrics based on their name prefix (Prometheus namespace)'
      ),
    },
    'filters-suffix': {
      title: t('sidebar.section.suffix-filters', 'Suffix filters'),
      description: t('sidebar.section.suffix-filters-description', 'Filter metrics based on their name suffix'),
    },
    'filters-recent': {
      title: t('sidebar.section.recent-metrics', 'Recent metrics filters'),
      description: t(
        'sidebar.section.recent-metrics-description',
        'Filter metrics based on when they started being ingested'
      ),
    },
    'groupby-labels': {
      title: t('sidebar.section.group-by-labels', 'Group by labels'),
      description: t('sidebar.section.group-by-labels-description', 'Group metrics by their label values'),
    },
    bookmarks: {
      title: t('sidebar.section.bookmarks', 'Bookmarks'),
      description: t('sidebar.section.bookmarks-description', 'Access your saved metrics for quick reference'),
    },
    settings: {
      title: t('sidebar.section.settings', 'Settings'),
      description: t('sidebar.section.settings-description', 'Settings'),
    },
  };

  return sectionMap[key] || { title: key, description: '' };
}

export const metricFilters = {
  rule: 'filters-rule',
  prefix: 'filters-prefix',
  suffix: 'filters-suffix',
  recent: 'filters-recent',
} as const;
const metricFiltersVariables = getObjectValues(metricFilters);
type MetricFiltersVariable = (typeof metricFiltersVariables)[number];

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
          title: t('sidebar.section.rules-filters', 'Rules filters'),
          description: t('sidebar.section.rules-filters-description', 'Filter metrics and recording rules'),
          icon: 'rules',
          computeGroups: computeRulesGroups,
          showHideEmpty: false,
          showSearch: false,
          active: Boolean(sectionValues.get('filters-rule')?.length),
        }),
        new MetricsFilterSection({
          key: 'filters-prefix',
          type: 'prefixes',
          title: t('sidebar.section.prefix-filters', 'Prefix filters'),
          description: t(
            'sidebar.section.prefix-filters-description',
            'Filter metrics based on their name prefix (Prometheus namespace)'
          ),
          icon: 'A_',
          computeGroups: computeMetricPrefixGroups,
          active: Boolean(sectionValues.get('filters-prefix')?.length),
        }),
        new MetricsFilterSection({
          key: 'filters-suffix',
          type: 'suffixes',
          title: t('sidebar.section.suffix-filters', 'Suffix filters'),
          description: t('sidebar.section.suffix-filters-description', 'Filter metrics based on their name suffix'),
          icon: '_Z',
          computeGroups: computeMetricSuffixGroups,
          active: Boolean(sectionValues.get('filters-suffix')?.length),
        }),
        new RecentMetricsSection({
          key: 'filters-recent',
          title: t('sidebar.section.recent-metrics', 'Recent metrics filters'),
          description: t(
            'sidebar.section.recent-metrics-description',
            'Filter metrics based on when they started being ingested'
          ),
          icon: 'clock-nine',
          active: Boolean(sectionValues.get('filters-recent')?.length),
        }),
        new LabelsBrowser({
          key: 'groupby-labels',
          variableName: VAR_WINGMAN_GROUP_BY,
          title: t('sidebar.section.group-by-labels', 'Group by labels'),
          description: t('sidebar.section.group-by-labels-description', 'Group metrics by their label values'),
          icon: 'groups',
        }),
        new BookmarksList({
          key: 'bookmarks',
          title: t('sidebar.section.bookmarks', 'Bookmarks'),
          description: t('sidebar.section.bookmarks-description', 'Access your saved metrics for quick reference'),
          icon: 'star',
        }),
        new Settings({
          key: 'settings',
          title: t('sidebar.section.settings', 'Settings'),
          description: t('sidebar.section.settings-description', 'Settings'),
          icon: 'cog',
          disabled: true,
        }),
      ],
      sectionValues,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const cleanupOtherMetricsVar = this.initOtherMetricsVar();

    this.subscribeToEvent(EventSectionValueChanged, (event) => {
      const { key, values } = event.payload;
      const { sectionValues } = this.state;
      const newSectionValues = new Map(sectionValues).set(key, values);
      this.setOtherMetricFilters(newSectionValues);
      this.setState({ sectionValues: newSectionValues });
    });

    // Open the sidebar to the most recently selected section if the "Default Open Sidebar" experiment is enabled
    if (!this.state.visibleSection?.state.key) {
      evaluateFeatureFlag('drilldown.metrics.default_open_sidebar').then((flagValue) => {
        if (flagValue === 'treatment' && !this.state.visibleSection?.state.key) {
          this.setActiveSection(userStorage.getItem(PREF_KEYS.SIDEBAR_SECTION) || 'filters-prefix');
        }
      });
    }

    // Enable hierarchical prefix filtering if the experiment flag is set to treatment
    evaluateFeatureFlag('drilldown.metrics.hierarchical_prefix_filtering').then((flagValue) => {
      if (flagValue === 'treatment') {
        const prefixSection = this.state.sections.find((s) => s.state.key === 'filters-prefix');
        if (prefixSection instanceof MetricsFilterSection) {
          prefixSection.setState({ hierarchical: true });
        }
      }
    });

    return () => {
      cleanupOtherMetricsVar();
    };
  }

  private setOtherMetricFilters(sectionValues: Map<string, string[]>) {
    const otherMetricFiltersVar = sceneGraph.lookupVariable(VAR_OTHER_METRIC_FILTERS, this);
    if (!isAdHocFiltersVariable(otherMetricFiltersVar)) {
      return;
    }

    const varToTextMap: Record<MetricFiltersVariable, string> = {
      'filters-rule': t('sidebar.filter-type.rule-group', 'rule group'),
      'filters-prefix': t('sidebar.filter-type.prefix', 'prefix'),
      'filters-suffix': t('sidebar.filter-type.suffix', 'suffix'),
      'filters-recent': t('sidebar.filter-type.recent', 'recent'),
    };

    const newFilters = Array.from(sectionValues.entries()).reduce<Array<AdHocFilterWithLabels<{}>>>(
      (acc, [key, value]) => {
        if (value.length && metricFiltersVariables.includes(key as MetricFiltersVariable)) {
          acc.push({
            key,
            operator: '=',
            value: value.join(', '),
            keyLabel: varToTextMap[key as MetricFiltersVariable],
          });
        }

        return acc;
      },
      []
    );

    otherMetricFiltersVar.setState({
      filters: newFilters,
      hide: newFilters.length ? VariableHide.hideLabel : VariableHide.hideVariable,
    });
  }

  /**
   * Initialize the other metrics variable and set the filters from the current sidebar selections.
   * This powers the read-only, "other metric filters" UI next to the label filters.
   * The purpose of this is to provide users with at-a-glance feedback about the current sidebar
   * selections, without needing to interact with the sidebar.
   */
  private initOtherMetricsVar() {
    const currentVariableSet = getTrailFor(this).state.$variables;
    if (!currentVariableSet) {
      return () => {};
    }

    const otherMetricFiltersVar = new AdHocFiltersVariable({
      name: VAR_OTHER_METRIC_FILTERS,
      readOnly: true,
      skipUrlSync: true,
      datasource: null,
      hide: VariableHide.hideVariable,
      layout: 'combobox',
      applyMode: 'manual',
      allowCustomValue: true,
    });

    currentVariableSet.setState({
      variables: [...currentVariableSet.state.variables, otherMetricFiltersVar],
    });

    this.setOtherMetricFilters(this.state.sectionValues);

    return () => {
      currentVariableSet.setState({
        variables: [...currentVariableSet.state.variables.filter((v) => v !== otherMetricFiltersVar)],
      });
    };
  }

  private static getSectionValuesFromUrl() {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const sectionValues = new Map();

    for (const filterKey of metricFiltersVariables) {
      // Check for both namespaced key (for embedded mode) and raw key (for regular mode)
      const namespacedKey = `${embeddedTrailNamespace}-${filterKey}`;
      const filterValueFromUrl = urlSearchParams.get(namespacedKey) || urlSearchParams.get(filterKey);
      sectionValues.set(filterKey, filterValueFromUrl ? filterValueFromUrl.split(',').map((v) => v.trim()) : []);
    }

    return sectionValues;
  }

  private setActiveSection(sectionKey: string) {
    const { visibleSection, sections } = this.state;

    if (!sectionKey || sectionKey === visibleSection?.state.key) {
      // Report closing the sidebar
      reportExploreMetrics('metrics_sidebar_toggled', {
        action: 'closed',
        section: visibleSection?.state.key,
      });

      this.setState({ visibleSection: null });
      return;
    }

    // Keep track of the section that the user has most recently selected
    userStorage.setItem(PREF_KEYS.SIDEBAR_SECTION, sectionKey);

    // Report opening the sidebar with the selected section
    reportExploreMetrics('metrics_sidebar_toggled', {
      action: 'opened',
      section: sectionKey,
    });

    if (sectionKey === 'filters-prefix') {
      reportExploreMetrics('sidebar_prefix_filter_section_clicked', {});
    } else if (sectionKey === 'filters-suffix') {
      reportExploreMetrics('sidebar_suffix_filter_section_clicked', {});
    } else if (sectionKey === 'filters-recent') {
      reportExploreMetrics('sidebar_recent_filter_section_clicked', {});
    }

    this.setState({
      visibleSection: sections.find((section) => section.state.key === sectionKey) ?? null,
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<SideBar>) => {
    const styles = useStyles2(getStyles);
    const { sections, visibleSection, sectionValues } = model.useState();

    const labelsVariableValue = sceneGraph
      .findByKeyAndType(model, VAR_WINGMAN_GROUP_BY, LabelsVariable)
      .useState().value;

    return (
      <div className={styles.container}>
        <Stack direction="row" height="100%" gap={0}>
          <div className={styles.buttonsBar} data-testid="sidebar-buttons">
            <Stack direction="column" alignItems="center" gap={0}>
              {sections.map((section) => {
                const { key, icon: iconOrText, disabled, active } = section.state;
                const visible = visibleSection?.state.key === key;
                const translatedInfo = getTranslatedSectionInfo(key);
                let isActive;
                let tooltip;

                if (key === 'groupby-labels') {
                  isActive = Boolean(labelsVariableValue && labelsVariableValue !== NULL_GROUP_BY_VALUE);
                  tooltip = `${translatedInfo.title}: ${labelsVariableValue}`;
                } else {
                  isActive = active;
                  tooltip = sectionValues.get(key)?.length
                    ? `${translatedInfo.title}: ${sectionValues.get(key)?.join(', ')}`
                    : translatedInfo.title;
                }

                return (
                  <div
                    key={key}
                    className={cx(
                      styles.buttonContainer,
                      visible && 'visible',
                      isActive && 'active',
                      disabled && 'disabled'
                    )}
                  >
                    <SideBarButton
                      key={key}
                      ariaLabel={translatedInfo.title}
                      disabled={disabled}
                      visible={visible}
                      active={isActive}
                      tooltip={tooltip}
                      onClick={() => model.setActiveSection(key)}
                      iconOrText={iconOrText}
                    />
                  </div>
                );
              })}
            </Stack>
          </div>
          {visibleSection && (
            <div className={styles.content} data-testid="sidebar-content">
              <IconButton
                className={styles.closeButton}
                name="times"
                aria-label={t('sidebar.close-aria-label', 'Close')}
                tooltip={t('sidebar.close-tooltip', 'Close')}
                tooltipPlacement="top"
                onClick={() => model.setActiveSection('')}
              />
              {/* TODO: find a better way */}
              {visibleSection instanceof MetricsFilterSection && <visibleSection.Component model={visibleSection} />}
              {visibleSection instanceof RecentMetricsSection && <visibleSection.Component model={visibleSection} />}
              {visibleSection instanceof LabelsBrowser && <visibleSection.Component model={visibleSection} />}
              {visibleSection instanceof BookmarksList && <visibleSection.Component model={visibleSection} />}
              {visibleSection instanceof Settings && <visibleSection.Component model={visibleSection} />}
            </div>
          )}
        </Stack>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'relative',
      height: '100%',
      overflow: 'hidden',
    }),
    buttonsBar: css({
      width: '42px',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.primary,
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
    }),
  };
}
