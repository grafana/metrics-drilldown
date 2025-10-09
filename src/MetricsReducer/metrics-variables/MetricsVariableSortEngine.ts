import { sceneGraph, SceneVariableValueChangedEvent, type QueryVariable } from '@grafana/scenes';

import { sortRelatedMetrics } from 'MetricScene/RelatedMetrics/sortRelatedMetrics';
import {
  MetricsSorter,
  sortMetricsAlphabetically,
  sortMetricsByCount,
  sortMetricsWithRecentFirst,
  type SortingOption,
} from 'MetricsReducer/list-controls/MetricsSorter/MetricsSorter';
import { type MetricUsageType } from 'MetricsReducer/list-controls/MetricsSorter/MetricUsageFetcher';
import { logger } from 'shared/logger/logger';

import { areArraysEqual } from './helpers/areArraysEqual';

export class MetricsVariableSortEngine {
  private variable: QueryVariable;
  private lastMetrics: string[];
  private sortBy?: SortingOption | 'related';

  constructor(variable: QueryVariable) {
    this.variable = variable;
    this.sortBy = undefined;
    this.lastMetrics = [];
  }

  public async sort(sortBy = this.sortBy, options: Record<string, any> = {}) {
    const metrics = this.variable.state.options.map((option) => option.value as string);

    if (sortBy === this.sortBy && areArraysEqual(metrics, this.lastMetrics)) {
      return;
    }

    let sortedMetrics: string[];

    switch (sortBy) {
      case 'alphabetical':
        sortedMetrics = sortMetricsAlphabetically(metrics, 'asc');
        break;

      case 'alphabetical-reversed':
        sortedMetrics = sortMetricsAlphabetically(metrics, 'desc');
        break;

      case 'dashboard-usage':
      case 'alerting-usage':
        sortedMetrics = await this.sortByUsage(metrics, sortBy);
        break;

      case 'related':
        sortedMetrics = sortRelatedMetrics(metrics, options.metric);
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
      if (!metricsSorter) {
        logger.warn('Metrics sorter not found. Returning unsorted metrics.', { usageType });
        return metrics;
      }
      const usageMetrics = await metricsSorter.getUsageMetrics(usageType);
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
