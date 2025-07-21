import { sceneGraph, type MultiValueVariable } from '@grafana/scenes';

import { VAR_FILTERED_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { areArraysEqual } from 'WingmanDataTrail/MetricsVariables/helpers/areArraysEqual';
import { VAR_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

import { CountsProvider, type CountsProviderState } from './CountsProvider';

export class MetricVariableCountsProvider extends CountsProvider<CountsProviderState> {
  constructor() {
    super({ key: 'MetricVariableCountsProvider' });

    this.addActivationHandler(() => {
      const nonFilteredVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MultiValueVariable;
      const filteredVariable = sceneGraph.lookupVariable(VAR_FILTERED_METRICS_VARIABLE, this) as MultiValueVariable;

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
    });
  }
}
