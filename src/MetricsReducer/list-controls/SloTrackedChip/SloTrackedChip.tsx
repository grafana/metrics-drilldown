import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneObjectUrlValues,
  type SceneVariable,
} from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_FILTERED_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/FilteredMetricsVariable';
import {
  VAR_METRICS_VARIABLE,
  type MetricOptions,
  type MetricsVariable,
} from 'MetricsReducer/metrics-variables/MetricsVariable';
import { MetricsVariableFilterEngine } from 'MetricsReducer/metrics-variables/MetricsVariableFilterEngine';
import { MetricsReducer } from 'MetricsReducer/MetricsReducer';
import { VAR_DATASOURCE } from 'shared/shared';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { EventFiltersChanged } from '../../SideBar/sections/MetricsFilterSection/EventFiltersChanged';
import { type SloMetricSignals } from '../MetricsSorter/fetchers/fetchSloMetricSignals';
import { MetricsSorter } from '../MetricsSorter/MetricsSorter';

const URL_PARAM_KEY = 'filter-slo-tracked';

const INITIAL_SIGNALS: SloMetricSignals = {
  datasourceUid: '',
  status: 'disabled',
  trackedMetrics: new Map(),
  activeBurnMetrics: new Set(),
};

interface SloTrackedChipState extends SceneObjectState {
  active: boolean;
  signals: SloMetricSignals;
  matchingCount: number;
  visible: boolean;
}

export class SloTrackedChip extends SceneObjectBase<SloTrackedChipState> {
  private loadGeneration = 0;

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERED_METRICS_VARIABLE, VAR_DATASOURCE],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      if (variable.state.name === VAR_DATASOURCE) {
        void this.loadSignals();
      } else {
        this.updateMatchingCount();
      }
    },
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: [URL_PARAM_KEY] });

  constructor() {
    super({
      key: 'slo-tracked-chip',
      active: false,
      signals: INITIAL_SIGNALS,
      matchingCount: 0,
      visible: false,
    });

    this.addActivationHandler(() => {
      void this.loadSignals();
    });
  }

  getUrlState() {
    return { [URL_PARAM_KEY]: this.state.active ? 'true' : '' };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const urlValue = values[URL_PARAM_KEY];
    const shouldBeActive = urlValue === 'true' || urlValue === '1';
    if (shouldBeActive === this.state.active) {
      return;
    }

    this.setState({ active: shouldBeActive });
    if (this.state.signals.status === 'ready') {
      this.publishFilterEvent(shouldBeActive);
    }
  }

  private async loadSignals() {
    const generation = ++this.loadGeneration;
    const wasActive = this.state.active;
    if (wasActive) {
      this.publishFilterEvent(false);
    }
    this.setState({ visible: false, matchingCount: 0 });

    try {
      const datasourceUid = this.getDatasourceUid();
      const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
      const signals = await metricsSorter.getSloMetricSignals(datasourceUid);
      if (generation !== this.loadGeneration) {
        return;
      }

      if (signals.status !== 'ready') {
        this.setState({ signals, visible: false, active: false });
        return;
      }

      this.setState({ signals, visible: true });
      const matchingCount = this.updateMatchingCount();
      if (this.state.active && matchingCount === 0) {
        this.setState({ active: false });
        this.publishFilterEvent(false);
        return;
      }
      if (this.state.active) {
        this.publishFilterEvent(true);
      }
    } catch {
      if (generation !== this.loadGeneration) {
        return;
      }
      this.setState({ signals: INITIAL_SIGNALS, visible: false, active: false });
    }
  }

  private getDatasourceUid(): string {
    return sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue()?.toString() ?? '';
  }

  private updateMatchingCount(): number | undefined {
    if (this.state.signals.status !== 'ready' || this.state.signals.trackedMetrics.size === 0) {
      this.setState({ matchingCount: 0 });
      return 0;
    }

    try {
      const metricsReducer = sceneGraph.getAncestor(this, MetricsReducer);
      const filterEngine = metricsReducer.state.enginesMap.get(VAR_FILTERED_METRICS_VARIABLE)?.filterEngine;
      if (!filterEngine) {
        this.setState({ matchingCount: 0 });
        return undefined;
      }

      const metricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable;
      if (metricsVariable.state.loading) {
        return undefined;
      }

      const originalOptions = metricsVariable.state.options as MetricOptions;
      const filtersWithoutSlo = { ...filterEngine.getFilters(), sloTrackedMetrics: [] };
      const optionsForCounting = MetricsVariableFilterEngine.getFilteredOptions(originalOptions, filtersWithoutSlo);
      const count = optionsForCounting.filter((option) =>
        this.state.signals.trackedMetrics.has(option.value as string)
      ).length;
      this.setState({ matchingCount: count });
      return count;
    } catch {
      this.setState({ matchingCount: 0 });
      return undefined;
    }
  }

  private publishFilterEvent(active: boolean) {
    const metricNames = active ? [...this.state.signals.trackedMetrics.keys()] : [];
    this.publishEvent(new EventFiltersChanged({ type: 'sloTrackedMetrics', filters: metricNames }), true);
  }

  public toggle = () => {
    const active = !this.state.active;
    this.setState({ active });
    this.publishFilterEvent(active);
    reportExploreMetrics('slo_tracked_filter_toggled', {
      action: active ? 'activated' : 'deactivated',
      matching_count: this.state.matchingCount,
    });
  };

  public static readonly Component = ({ model }: SceneComponentProps<SloTrackedChip>) => {
    const styles = useStyles2(getStyles);
    const { active, matchingCount, visible } = model.useState();

    if (!visible) {
      return null;
    }

    const isEmpty = matchingCount === 0 && !active;
    return (
      <Button
        className={`${styles.chip} ${active ? styles.chipActive : ''} ${isEmpty ? styles.chipEmpty : ''}`}
        variant={active ? 'primary' : 'secondary'}
        size="sm"
        onClick={model.toggle}
        aria-pressed={active}
        aria-label={
          active
            ? t('slo-tracked-chip.aria-label-active', 'Remove SLO-tracked filter')
            : t('slo-tracked-chip.aria-label-inactive', 'Filter by SLO-tracked metrics')
        }
        disabled={isEmpty}
        title={
          isEmpty
            ? t('slo-tracked-chip.tooltip-empty', 'No SLO-tracked metrics in the current filtered set')
            : undefined
        }
      >
        {t('slo-tracked-chip.label', 'SLO-tracked ({{count}})', { count: matchingCount })}
      </Button>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    chip: css({ whiteSpace: 'nowrap', alignSelf: 'center' }),
    chipActive: css({ fontWeight: theme.typography.fontWeightMedium }),
    chipEmpty: css({ opacity: 0.5 }),
  };
}
