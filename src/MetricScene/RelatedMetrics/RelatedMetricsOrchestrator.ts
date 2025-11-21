import { sceneGraph, type QueryVariable } from '@grafana/scenes';

import { VAR_FILTERED_METRICS_VARIABLE } from '../../MetricsReducer/metrics-variables/FilteredMetricsVariable';
import { isQueryVariable } from '../../shared/utils/utils.variables';
import { type MetricScene } from '../MetricScene';
import { type RelatedMetricsScene } from './RelatedMetricsScene';

/**
 * Manager class that handles counting related metrics for badge display.
 */
export class RelatedMetricsOrchestrator {
  private readonly _metricScene: MetricScene;
  private readonly _changeHandlers = {
    relatedMetricsCount: [] as Array<(count: number) => void>,
  };
  private readonly _internalState = {
    relatedMetricsCount: 0,
  };

  constructor(metricScene: MetricScene) {
    this._metricScene = metricScene;
  }

  set relatedMetricsCount(count: number) {
    this._internalState.relatedMetricsCount = count;
    this._changeHandlers.relatedMetricsCount.forEach((handler) => handler(this._internalState.relatedMetricsCount));
  }

  /**
   * Add a listener that will be called when the relatedMetricsCount changes.
   */
  addRelatedMetricsCountChangeHandler(handler: (count: number) => void) {
    this._changeHandlers.relatedMetricsCount.push(handler);
  }

  /**
   * Count the related metrics from the filtered metrics variable.
   */
  public countRelatedMetrics(): void {
    const relatedMetricsScene = this.getRelatedMetricsScene();
    if (!relatedMetricsScene) {
      this.relatedMetricsCount = 0;
      return;
    }

    const filteredMetricsVariable = this.getFilteredMetricsVariable(relatedMetricsScene);
    const count = filteredMetricsVariable.state.options.length;
    this.relatedMetricsCount = count;
  }

  private getRelatedMetricsScene(): RelatedMetricsScene | undefined {
    const { body } = this._metricScene.state;
    const relatedMetricsScene = body.state.selectedTab;
    if (relatedMetricsScene && 'listControls' in relatedMetricsScene.state) {
      return relatedMetricsScene as RelatedMetricsScene;
    }
    return undefined;
  }

  private getFilteredMetricsVariable(scene: RelatedMetricsScene): QueryVariable {
    const variable = sceneGraph.lookupVariable(VAR_FILTERED_METRICS_VARIABLE, scene);
    if (!variable || !isQueryVariable(variable)) {
      throw new Error('Filtered metrics variable not found');
    }
    return variable;
  }
}
