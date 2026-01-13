import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  type SceneComponentProps,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { RadioButtonList, useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { MetricsReducer } from 'MetricsReducer/MetricsReducer';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { EventSectionValueChanged } from '../EventSectionValueChanged';
import { SectionTitle } from '../SectionTitle';
import { type SideBarSectionState } from '../types';

interface RecentMetricsSectionState extends SideBarSectionState {
  intervalOptions: Array<{
    label: string;
    value: string;
  }>;
  currentInterval: string;
}

const INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '3h', '6h', '12h', '24h'] as const;

function getIntervalOptions(): Array<{ value: string; label: string }> {
  return [
    { value: 'all', label: t('sidebar.recent-metrics.all-time', 'All time') },
    ...INTERVALS.map((value) => ({
      value,
      label: t('sidebar.recent-metrics.past-interval', 'Past {{interval}}', { interval: value }),
    })),
  ];
}

const INTERVAL_OPTIONS = [
  { value: 'all', label: 'All time' },
  ...INTERVALS.map((value) => ({
    value,
    label: `Past ${value}`,
  })),
];

export class RecentMetricsSection extends SceneObjectBase<RecentMetricsSectionState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: [this.state.key] });

  getUrlState() {
    const value = this.state.currentInterval === 'all' ? '' : this.state.currentInterval;
    return {
      [this.state.key]: value,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const value = (values[this.state.key] as string) || 'all';
    if (value !== this.state.currentInterval && INTERVAL_OPTIONS.some((o) => o.value === value)) {
      this.setState({ currentInterval: value });
    }
  }

  constructor({
    key,
    title,
    description,
    icon,
    active,
    disabled,
  }: {
    key: RecentMetricsSectionState['key'];
    title: RecentMetricsSectionState['title'];
    description: RecentMetricsSectionState['description'];
    icon: RecentMetricsSectionState['icon'];
    active?: RecentMetricsSectionState['active'];
    disabled?: RecentMetricsSectionState['disabled'];
  }) {
    super({
      key,
      title,
      description,
      icon,
      active: active ?? false,
      disabled: disabled ?? false,
      intervalOptions: INTERVAL_OPTIONS,
      currentInterval: 'all',
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.subscribeToState(async (newState, prevState) => {
      if (newState.currentInterval === prevState.currentInterval) {
        return;
      }

      // update section state
      this.setState({ active: Boolean(newState.currentInterval !== 'all') });

      this.publishEvent(
        new EventSectionValueChanged({
          key: this.state.key,
          values: newState.currentInterval !== 'all' ? [newState.currentInterval] : [],
        }),
        true
      );
    });
  }

  private update(interval: string) {
    this.setState({ currentInterval: interval });

    const allMetricsVariables = [
      ...sceneGraph.findAllObjects(sceneGraph.getAncestor(this, MetricsReducer), (o) => o instanceof MetricsVariable),
      sceneGraph.findByKeyAndType(this, VAR_METRICS_VARIABLE, MetricsVariable),
    ] as MetricsVariable[];

    if (interval === 'all') {
      allMetricsVariables.forEach((v) => v.fetchAllMetrics());
    } else {
      allMetricsVariables.forEach((v) => v.fetchRecentMetrics(interval));
    }
  }

  private onChangeInterval = (interval: string) => {
    reportExploreMetrics('sidebar_recent_filter_selected', { interval });
    this.update(interval);
  };

  public static readonly Component = ({ model }: SceneComponentProps<RecentMetricsSection>) => {
    const styles = useStyles2(getStyles);
    const { title, description, currentInterval } = model.useState();
    const translatedOptions = getIntervalOptions();

    return (
      <div className={styles.container} data-testid="new-metrics">
        <SectionTitle title={title} description={description} />

        <div className={styles.list}>
          <RadioButtonList
            name="offsets"
            value={currentInterval}
            options={translatedOptions}
            onChange={model.onChangeInterval}
          />
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      overflowY: 'hidden',
    }),
    list: css({
      height: '100%',
      padding: theme.spacing(0, 1, 1, 1),
      overflowY: 'auto',
    }),
  };
}
