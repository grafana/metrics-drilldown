import { sceneGraph, type QueryVariable } from '@grafana/scenes';

import { type LabelBreakdownScene } from './LabelBreakdownScene';
import { type MetricScene } from '../MetricScene';
import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { MetricLabelValuesList } from './MetricLabelValuesList/MetricLabelValuesList';
import { VAR_GROUP_BY } from '../../shared/shared';
import { isQueryVariable } from '../../shared/utils/utils.variables';

/**
 * Manager class that handles counting breakdown panels for badge display.
 */
export class BreakdownPanelsOrchestrator {
  private readonly _metricScene: MetricScene;
  private readonly _changeHandlers = {
    breakdownPanelsCount: [] as Array<(count: number) => void>,
  };
  private readonly _internalState = {
    breakdownPanelsCount: 0,
  };

  constructor(metricScene: MetricScene) {
    this._metricScene = metricScene;
  }

  set breakdownPanelsCount(count: number) {
    this._internalState.breakdownPanelsCount = count;
    this._changeHandlers.breakdownPanelsCount.forEach((handler) => handler(this._internalState.breakdownPanelsCount));
  }

  /**
   * Add a listener that will be called when the breakdownPanelsCount changes.
   */
  addBreakdownPanelsCountChangeHandler(handler: (count: number) => void) {
    this._changeHandlers.breakdownPanelsCount.push(handler);
  }

  /**
   * Count the breakdown panels based on the current breakdown scene body.
   * - For MetricLabelsList: count variable options
   * - For MetricLabelValuesList: count data frames
   */
  public countBreakdownPanels(): void {
    const breakdownScene = this.getBreakdownScene();
    if (!breakdownScene || !breakdownScene.state.body) {
      this.breakdownPanelsCount = 0;
      return;
    }

    const { body } = breakdownScene.state;

    if (body instanceof MetricLabelsList) {
      // Count labels from the group by variable
      const groupByVariable = this.getGroupByVariable(breakdownScene);
      const count = groupByVariable.state.options.length;
      this.breakdownPanelsCount = count;
    } else if (body instanceof MetricLabelValuesList) {
      // Count data frames from the repeater
      // The body will have a SceneByFrameRepeater that manages panels
      const repeater = body.state.body;
      if (repeater && 'state' in repeater && 'counts' in repeater.state) {
        // Use the current count from the repeater which tracks filtered/visible frames
        this.breakdownPanelsCount = repeater.state.counts.current;
      } else {
        this.breakdownPanelsCount = 0;
      }
    } else {
      this.breakdownPanelsCount = 0;
    }
  }

  private getBreakdownScene(): LabelBreakdownScene | undefined {
    const { body } = this._metricScene.state;
    const breakdownScene = body.state.selectedTab;
    if (breakdownScene && 'metric' in breakdownScene.state) {
      return breakdownScene as LabelBreakdownScene;
    }
    return undefined;
  }

  private getGroupByVariable(scene: LabelBreakdownScene): QueryVariable {
    const variable = sceneGraph.lookupVariable(VAR_GROUP_BY, scene);
    if (!variable || !isQueryVariable(variable)) {
      throw new Error('Group by variable not found');
    }
    return variable;
  }
}
