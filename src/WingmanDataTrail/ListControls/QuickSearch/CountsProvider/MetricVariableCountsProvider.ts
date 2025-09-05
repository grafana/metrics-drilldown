import { sceneGraph, type MultiValueVariable } from '@grafana/scenes';

import { VAR_FILTERED_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { areArraysEqual } from 'WingmanDataTrail/MetricsVariables/helpers/areArraysEqual';
import { VAR_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

import { CountsProvider } from './CountsProvider';

export class MetricVariableCountsProvider extends CountsProvider {
  constructor() {
    super({ key: 'MetricVariableCountsProvider' });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const nonFilteredVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MultiValueVariable;
    const filteredVariable = sceneGraph.lookupVariable(VAR_FILTERED_METRICS_VARIABLE, this) as MultiValueVariable;

    this.setInitCounts(nonFilteredVariable, filteredVariable);

    this._subs.add(
      nonFilteredVariable.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.options, prevState.options)) {
          this.setState({
            counts: {
              current: filteredVariable.state.options.length,
              total: newState.options.length,
            },
          });
        }
      })
    );

    this._subs.add(
      filteredVariable.subscribeToState((newState, prevState) => {
        if (!newState.loading && !prevState.loading && !areArraysEqual(newState.options, prevState.options)) {
          this.setState({
            counts: {
              current: newState.options.length,
              total: nonFilteredVariable.state.options.length,
            },
          });
        }
      })
    );
  }

  private setInitCounts(nonFilteredVariable: MultiValueVariable, filteredVariable: MultiValueVariable) {
    const initCounts = { current: 0, total: 0 };

    // We make sure the count of metrics is not 0 in a scenario where the user goes from the MetricsReducer to the MetricScene and back.
    // Indeed, sometimes, the variables already have their options and do not load new ones.
    if (!nonFilteredVariable.state.loading && nonFilteredVariable.state.options.length) {
      initCounts.total = nonFilteredVariable.state.options.length;
    }

    if (!filteredVariable.state.loading && filteredVariable.state.options.length) {
      initCounts.current = filteredVariable.state.options.length;
    }

    this.setState({ counts: initCounts });
  }
}
