import { t } from '@grafana/i18n';
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
  private generation = 0;

  constructor(variable: QueryVariable) {
    this.variable = variable;
    this.sortBy = undefined;
    this.lastMetrics = [];
  }

  public async sort(sortBy = this.sortBy, options: Record<string, any> = {}) {
    const generation = ++this.generation;
    const metrics = this.variable.state.options.map((option) => option.value as string);
    const sorter = this.findSorter();
    if (sortBy !== 'jev-relevance') {
      sorter?.state?.ranking?.cancel();
    }

    if (sortBy !== 'jev-relevance' && sortBy === this.sortBy && areArraysEqual(metrics, this.lastMetrics)) {
      return;
    }

    let sortedMetrics: string[];

    switch (sortBy) {
      case 'jev-relevance':
        sortedMetrics = sorter
          ? await sorter.state.ranking.rank(metrics, sorter, options.filterContext, (baseline) => {
              if (generation === this.generation) {
                this.applyOrder(baseline);
              }
            })
          : sortMetricsWithRecentFirst(metrics);
        break;

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

      case 'firing-alerts':
        sortedMetrics = await this.sortByFiringAlerts(metrics);
        break;

      case 'related':
        sortedMetrics = sortRelatedMetrics(metrics, options.metric);
        break;

      default:
        sortedMetrics = sortMetricsWithRecentFirst(metrics);
        break;
    }

    if (generation !== this.generation) {
      return;
    }
    this.sortBy = sortBy;
    this.lastMetrics = sortedMetrics;

    this.applyOrder(sortedMetrics);
  }

  public dispose() {
    this.generation++;
    this.findSorter()?.state?.ranking?.cancel();
  }

  private findSorter(): MetricsSorter | undefined {
    try {
      return sceneGraph.findByKeyAndType(this.variable, 'metrics-sorter', MetricsSorter);
    } catch {
      return undefined;
    }
  }

  private applyOrder(sortedMetrics: string[]) {
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

  private async sortByFiringAlerts(metrics: string[]) {
    try {
      const metricsSorter = sceneGraph.findByKeyAndType(this.variable, 'metrics-sorter', MetricsSorter);
      if (!metricsSorter) {
        logger.warn('Metrics sorter not found. Returning unsorted metrics.');
        return metrics;
      }
      const firingAlertCounts = await metricsSorter.getFiringAlertCountsAsRecord();
      return sortMetricsByCount(metrics, firingAlertCounts);
    } catch (err) {
      const error = typeof err === 'string' ? new Error(err) : (err as Error);
      logger.error(error, {
        message: t('metrics-variable-sort-engine.error.firing-alerts', 'Failed to sort by firing alerts'),
      });
      return metrics;
    }
  }

  private notifyUpdate() {
    // hack to force SceneByVariableRepeater to re-render
    this.variable.publishEvent(new SceneVariableValueChangedEvent(this.variable), true);
  }
}
