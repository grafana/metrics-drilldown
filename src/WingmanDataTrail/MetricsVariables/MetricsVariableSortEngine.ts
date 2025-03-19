import { SceneVariableValueChangedEvent, type MultiValueVariable } from '@grafana/scenes';

import { getTrailFor } from 'utils';
import {
  sortMetricsAlphabetically,
  sortMetricsByCount,
  sortMetricsReverseAlphabetically,
  type SortingOption,
} from 'WingmanDataTrail/HeaderControls/MetricsSorter/MetricsSorter';

export class MetricsVariableSortEngine {
  private variable: MultiValueVariable;
  private sortBy?: SortingOption;

  constructor(variable: MultiValueVariable) {
    this.variable = variable;
    this.sortBy = undefined;
  }

  public sort(sortBy = this.sortBy, notify = true) {
    this.sortBy = sortBy;

    const trail = getTrailFor(this.variable);
    const metrics = (this.variable as MultiValueVariable).state.options.map((option) => option.value as string);

    switch (sortBy) {
      case 'dashboard-usage':
        this.variable.setState({
          options: sortMetricsByCount(metrics, trail.state.dashboardMetrics || {}).map((metricName) => ({
            label: metricName,
            value: metricName,
          })),
        });
        break;

      case 'alerting-usage':
        this.variable.setState({
          options: sortMetricsByCount(metrics, trail.state.alertingMetrics || {}).map((metricName) => ({
            label: metricName,
            value: metricName,
          })),
        });
        break;

      case 'reverse-alphabetical':
        this.variable.setState({
          options: sortMetricsReverseAlphabetically(metrics).map((metricName) => ({
            label: metricName,
            value: metricName,
          })),
        });
        break;

      default:
        this.variable.setState({
          options: sortMetricsAlphabetically(metrics).map((metricName) => ({
            label: metricName,
            value: metricName,
          })),
        });
        break;
    }

    if (notify) {
      this.notifyUpdate();
    }
  }

  private notifyUpdate() {
    // hack to force SceneByVariableRepeater to re-render
    this.variable.publishEvent(new SceneVariableValueChangedEvent(this.variable), true);
  }
}
