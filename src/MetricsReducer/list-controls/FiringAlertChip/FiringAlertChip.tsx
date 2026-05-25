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
} from '@grafana/scenes';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_FILTERED_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/FilteredMetricsVariable';
import { VAR_METRICS_VARIABLE, type MetricOptions, type MetricsVariable } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { MetricsVariableFilterEngine } from 'MetricsReducer/metrics-variables/MetricsVariableFilterEngine';
import { MetricsReducer } from 'MetricsReducer/MetricsReducer';
import { evaluateFeatureFlag } from 'shared/featureFlags/openFeature';
import { logger } from 'shared/logger/logger';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { EventFiltersChanged } from '../../SideBar/sections/MetricsFilterSection/EventFiltersChanged';
import { fetchFiringAlertMetrics } from '../MetricsSorter/fetchers/fetchFiringAlertMetrics';

const URL_PARAM_KEY = 'filter-firing-alerts';

interface FiringAlertChipState extends SceneObjectState {
  active: boolean;
  firingAlertMetrics: Map<string, number>;
  matchingCount: number;
  loading: boolean;
  /** Chip is present in scene graph but hidden when flag is off */
  visible: boolean;
}

export class FiringAlertChip extends SceneObjectBase<FiringAlertChipState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERED_METRICS_VARIABLE],
    onReferencedVariableValueChanged: () => {
      this.updateMatchingCount();
    },
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: [URL_PARAM_KEY] });

  getUrlState() {
    return { [URL_PARAM_KEY]: this.state.active ? 'true' : '' };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const urlValue = values[URL_PARAM_KEY];
    const shouldBeActive = urlValue === 'true' || urlValue === '1';

    if (shouldBeActive !== this.state.active) {
      this.setState({ active: shouldBeActive });
    }
  }

  constructor() {
    super({
      key: 'firing-alert-chip',
      active: false,
      firingAlertMetrics: new Map(),
      matchingCount: 0,
      loading: true,
      visible: false,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private async onActivate() {
    const flagEnabled = await evaluateFeatureFlag('drilldown.metrics.sort_by_firing_alerts');

    if (!flagEnabled) {
      this.setState({ loading: false, visible: false });
      return;
    }

    this.setState({ visible: true });

    try {
      const metricsMap = await fetchFiringAlertMetrics();
      this.setState({ firingAlertMetrics: metricsMap, loading: false });
    } catch (err) {
      logger.error(err instanceof Error ? err : new Error(String(err)), {
        message: t('firing-alert-chip.fetch-error', 'FiringAlertChip: failed to load firing alert metrics'),
      });
      this.setState({ loading: false });
    }

    this.updateMatchingCount();

    // If URL-restored state is active, publish filter event now that data is loaded
    if (this.state.active) {
      this.publishFilterEvent(true);
    }
  }

  private updateMatchingCount() {
    const { firingAlertMetrics } = this.state;

    if (firingAlertMetrics.size === 0) {
      this.setState({ matchingCount: 0 });
      return;
    }

    try {
      const metricsReducer = sceneGraph.getAncestor(this, MetricsReducer);
      const filterEngine = metricsReducer.state.enginesMap.get(VAR_FILTERED_METRICS_VARIABLE)?.filterEngine;

      if (!filterEngine) {
        this.setState({ matchingCount: 0 });
        return;
      }

      // Count options filtered by everything except the firing alerts dimension
      const metricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable;
      const originalOptions = metricsVariable.state.options as MetricOptions;
      const filtersWithoutFiring = { ...filterEngine.getFilters(), firingAlertMetrics: [] };
      const optionsForCounting = MetricsVariableFilterEngine.getFilteredOptions(
        originalOptions,
        filtersWithoutFiring
      );

      const count = optionsForCounting.filter((o) => firingAlertMetrics.has(o.value as string)).length;
      this.setState({ matchingCount: count });
    } catch {
      this.setState({ matchingCount: 0 });
    }
  }

  private publishFilterEvent(active: boolean) {
    const metricNames = active ? [...this.state.firingAlertMetrics.keys()] : [];

    this.publishEvent(new EventFiltersChanged({ type: 'firingAlertMetrics', filters: metricNames }), true);
  }

  public toggle = () => {
    const newActive = !this.state.active;
    this.setState({ active: newActive });
    this.publishFilterEvent(newActive);

    reportExploreMetrics('firing_alert_filter_toggled', {
      action: newActive ? 'activated' : 'deactivated',
      matching_count: this.state.matchingCount,
    });
  };

  public static readonly Component = ({ model }: SceneComponentProps<FiringAlertChip>) => {
    const styles = useStyles2(getStyles);
    const { active, matchingCount, loading, visible } = model.useState();

    if (!visible) {
      return null;
    }

    if (loading) {
      return (
        <div className={styles.chipContainer}>
          <Spinner inline />
        </div>
      );
    }

    const label = t('firing-alert-chip.label', 'Has firing alerts ({{count}})', { count: matchingCount });
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
            ? t('firing-alert-chip.aria-label-active', 'Remove firing alerts filter')
            : t('firing-alert-chip.aria-label-inactive', 'Filter by firing alerts')
        }
        disabled={isEmpty}
        title={
          isEmpty
            ? t('firing-alert-chip.tooltip-empty', 'No metrics with firing alerts in the current filtered set')
            : undefined
        }
      >
        {label}
      </Button>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    chipContainer: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0, 0.5),
    }),
    chip: css({
      whiteSpace: 'nowrap',
    }),
    chipActive: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
    chipEmpty: css({
      opacity: 0.5,
    }),
  };
}
