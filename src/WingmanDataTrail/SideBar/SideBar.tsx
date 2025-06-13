import { css, cx } from '@emotion/css';
import { VariableHide, type GrafanaTheme2 } from '@grafana/data';
import {
  AdHocFiltersVariable,
  sceneGraph,
  SceneObjectBase,
  type AdHocFilterWithLabels,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_OTHER_METRIC_FILTERS } from 'shared';
import { getTrailFor } from 'utils';
import { isAdHocFiltersVariable } from 'utils/utils.variables';
import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { VAR_WINGMAN_GROUP_BY } from 'WingmanDataTrail/Labels/LabelsVariable';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import { computeMetricSuffixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricSuffixGroups';
import { computeRulesGroups } from 'WingmanDataTrail/MetricsVariables/computeRulesGroups';

import { reportExploreMetrics } from '../../interactions';
import { BookmarksList } from './sections/BookmarksList';
import { EventSectionValueChanged } from './sections/EventSectionValueChanged';
import { LabelsBrowser } from './sections/LabelsBrowser/LabelsBrowser';
import { MetricsFilterSection } from './sections/MetricsFilterSection/MetricsFilterSection';
import { Settings } from './sections/Settings';
import { SideBarButton } from './SideBarButton';

type Section = MetricsFilterSection | LabelsBrowser | BookmarksList | Settings;

interface SideBarState extends SceneObjectState {
  sections: Section[];
  visibleSection: Section | null;
  sectionValues: Map<string, string[]>;
}

export const metricFiltersVariables = ['filters-rule', 'filters-prefix', 'filters-suffix'] as const;
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
          title: 'Rules filters',
          description: 'Filter metrics and recording rules',
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
          description: 'Access your saved metrics for quick reference',
          icon: 'star',
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

    // FIXME: rule values are regexes, we do this only to disable adding the values to the button tooltip
    // we need to provide the corresponding label instead
    sectionValues.set('filters-rule', []);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const cleanupOtherMetricsVar = this.initOtherMetricsVar();

    this._subs.add(
      this.subscribeToEvent(EventSectionValueChanged, (event) => {
        const { key, values } = event.payload;
        const { sectionValues } = this.state;
        const newSectionValues = new Map(sectionValues).set(key, values);
        this.setOtherMetricFilters(newSectionValues);
        this.setState({ sectionValues: newSectionValues });
      })
    );

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
      'filters-rule': 'rule group',
      'filters-prefix': 'prefix',
      'filters-suffix': 'suffix',
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
      // Report closing the sidebar
      reportExploreMetrics('metrics_sidebar_toggled', {
        action: 'closed',
        section: visibleSection?.state.key,
      });

      this.setState({ visibleSection: null });
      return;
    }

    // Report opening the sidebar with the selected section
    reportExploreMetrics('metrics_sidebar_toggled', {
      action: 'opened',
      section: sectionKey,
    });

    if (sectionKey === 'filters-prefix') {
      reportExploreMetrics('sidebar_prefix_filter_section_clicked', {});
    } else if (sectionKey === 'filters-suffix') {
      reportExploreMetrics('sidebar_suffix_filter_section_clicked', {});
    }

    this.setState({
      visibleSection: sections.find((section) => section.state.key === sectionKey) ?? null,
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<SideBar>) => {
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
                data-testid={`sidebar-component ${title}`}
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
