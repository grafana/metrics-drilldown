import { sceneGraph, SceneVariableValueChangedEvent, type QueryVariable } from '@grafana/scenes';

import { logger } from 'tracking/logger/logger';
import {
  MetricsSorter,
  sortMetricsByCount,
  sortMetricsWithRecentFirst,
  type SortingOption,
} from 'WingmanDataTrail/ListControls/MetricsSorter/MetricsSorter';
import { type MetricUsageType } from 'WingmanDataTrail/ListControls/MetricsSorter/metricUsageFetcher';

import { areArraysEqual } from './helpers/areArraysEqual';

export class MetricsVariableSortEngine {
  private variable: QueryVariable;
  private lastMetrics: string[];
  private sortBy?: SortingOption;

  constructor(variable: QueryVariable) {
    this.variable = variable;
    this.sortBy = undefined;
    this.lastMetrics = [];
  }

  public async sort(sortBy = this.sortBy) {
    const metrics = this.variable.state.options.map((option) => option.value as string);

    if (sortBy === this.sortBy && areArraysEqual(metrics, this.lastMetrics)) {
      return;
    }

    let sortedMetrics: string[];

    switch (sortBy) {
      case 'dashboard-usage':
      case 'alerting-usage':
        sortedMetrics = await this.sortByUsage(metrics, sortBy);
        break;
      default:
        sortedMetrics = sortMetricsWithRecentFirst(metrics);
        break;
    }

    this.sortBy = sortBy;
    this.lastMetrics = sortedMetrics;

    this.variable.setState({
      options: sortedMetrics.map((metricName) => ({
        label: metricName,
        value: metricName,
      })),
    });

    this.notifyUpdate();
  }

  private async sortByUsage(metrics: string[], usageType: MetricUsageType) {
    try {
      const metricsSorter = sceneGraph.findByKeyAndType(this.variable, 'metrics-sorter', MetricsSorter);
      const usageMetrics = await metricsSorter?.getUsageMetrics(usageType);
      return sortMetricsByCount(metrics, usageMetrics);
    } catch (err) {
      const error = typeof err === 'string' ? new Error(err) : (err as Error);
      logger.error(error, {
        usageType,
      });
      return metrics;
    }
  }

  private notifyUpdate() {
    // hack to force SceneByVariableRepeater to re-render
    this.variable.publishEvent(new SceneVariableValueChangedEvent(this.variable), true);
  }
}
