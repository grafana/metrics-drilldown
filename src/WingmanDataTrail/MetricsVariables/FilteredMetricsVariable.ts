import { sceneGraph, SceneVariableValueChangedEvent, type VariableValueOption } from '@grafana/scenes';
import { cloneDeep, isEqual } from 'lodash';

import { VAR_FILTERS, VAR_FILTERS_EXPR } from 'shared';
import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { VAR_WINGMAN_GROUP_BY, type LabelsVariable } from 'WingmanDataTrail/Labels/LabelsVariable';
import { SideBar } from 'WingmanDataTrail/SideBar/SideBar';
import { VAR_MAIN_LABEL_VARIABLE, type MainLabelVariable } from 'WingmanOnboarding/HeaderControls/MainLabelVariable';

import { MetricsVariable } from './MetricsVariable';

export const VAR_FILTERED_METRICS_VARIABLE = 'filtered-metrics-wingman';

export type MetricOptions = Array<{ label: string; value: string }>;

type MetricFilters = {
  prefixes: string[];
  categories: string[];
  names: string[];
};

export class FilteredMetricsVariable extends MetricsVariable {
  initOptions: VariableValueOption[] = [];

  private filters: MetricFilters = {
    prefixes: [],
    categories: [],
    names: [],
  };

  constructor() {
    super({
      name: VAR_FILTERED_METRICS_VARIABLE,
      label: 'Filtered Metrics',
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  protected onActivate() {
    let sideBar = new SideBar({});

    // TEMP: this is just to make the unit tests pass so we can deploy
    // because this variable is added to the ancestor DataTrail Scene object - tried to move it to MetricsReducer, but it does not work
    // Also it makes the /a/grafana-metricsdrilldown-app/onboard-wingman page work ;)
    try {
      sideBar = sceneGraph.findByKeyAndType(this, 'sidebar', SideBar);
    } catch (error) {
      console.warn('Error in FilteredMetricsVariable onActivate', error);
    }

    this.subscribeToStateChange(sideBar);
    this.subscribeToUiFiltersChange(sideBar);

    this.subscribeToGroupByChange(sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, this) as LabelsVariable);
    this.subscribeToGroupByChange(sceneGraph.lookupVariable(VAR_MAIN_LABEL_VARIABLE, this) as MainLabelVariable);
  }

  private subscribeToStateChange(sideBar: SideBar) {
    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.loading === false && prevState.loading === true) {
          this.initOptions = cloneDeep(newState.options);

          const { selectedMetricPrefixes, selectedMetricCategories } = sideBar.state;

          this.applyFilters(
            {
              prefixes: selectedMetricPrefixes,
              categories: selectedMetricCategories,
            },
            // don't notify
            false,
            // force update to ensure the options are filtered (need it specifically when selecting a different group by label)
            true
          );
        }
      })
    );
  }

  private subscribeToUiFiltersChange(sideBar: SideBar) {
    // TODO: subscribe only to the filter sections in the side bar, once they are Scene objects (and not React components)
    this._subs.add(
      sideBar.subscribeToState((newState, prevState) => {
        if (!isEqual(newState.selectedMetricPrefixes, prevState.selectedMetricPrefixes)) {
          this.applyFilters({ prefixes: newState.selectedMetricPrefixes });
          return;
        }

        if (!isEqual(newState.selectedMetricCategories, prevState.selectedMetricCategories)) {
          this.applyFilters({ categories: newState.selectedMetricCategories });
          return;
        }
      })
    );
  }

  private subscribeToGroupByChange(groupByVariable: LabelsVariable | MainLabelVariable) {
    const updateQuery = (groupBy: string) => {
      const matcher = groupBy && groupBy !== NULL_GROUP_BY_VALUE ? `${groupBy}!="",$${VAR_FILTERS}` : `$${VAR_FILTERS}`;
      const query = `label_values({${matcher}}, __name__)`;

      if (query !== this.state.query) {
        this.setState({ query });
        this.refreshOptions();
      }
    };

    if (groupByVariable.isActive) {
      // ensure that the correct metrics are fetched when landing: sometimes filters are not interpolated and fetching metric names gives all the results
      // (we do the same in MetricsGroupByList.tsx)
      const filterExpression = sceneGraph.interpolate(this, VAR_FILTERS_EXPR, {});
      const groupBy = groupByVariable.state.value as string;
      const matcher =
        groupBy && groupBy !== NULL_GROUP_BY_VALUE ? `${groupBy}!="",${filterExpression}` : filterExpression;
      const query = `label_values({${matcher}}, __name__)`;

      if (query !== this.state.query) {
        this.setState({ query });
        this.refreshOptions();
        updateQuery(groupBy); // re-establish the subscription to the ad hoc filters changes
      }
    }

    this._subs.add(
      groupByVariable.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          updateQuery(newState.value as string);
        }
      })
    );
  }

  public applyFilters(filters: Partial<MetricFilters> = this.filters, notify = true, forceUpdate = false) {
    const updatedFilters = {
      ...this.filters,
      ...filters,
    };

    if (
      !forceUpdate &&
      (isEqual(this.filters, updatedFilters) ||
        (!updatedFilters.names.length && !updatedFilters.prefixes.length && !updatedFilters.categories.length))
    ) {
      this.filters = updatedFilters;

      this.setState({ options: this.initOptions });

      if (notify) {
        this.notifyUpdate();
      }

      return;
    }

    const allOptions = this.initOptions;
    let filteredOptions = allOptions as MetricOptions;

    if (updatedFilters.prefixes.length > 0) {
      filteredOptions = this.applyPrefixFilters(filteredOptions, updatedFilters.prefixes);
    }

    if (updatedFilters.categories.length > 0) {
      filteredOptions = this.applyCategoriesFilters(filteredOptions, updatedFilters.categories);
    }

    if (updatedFilters.names.length > 0) {
      filteredOptions = this.applyNamesFilters(filteredOptions, updatedFilters.names);
    }

    this.filters = updatedFilters;

    this.setState({ options: filteredOptions });

    if (notify) {
      this.notifyUpdate();
    }
  }

  private applyPrefixFilters(options: MetricOptions, prefixes: string[]): MetricOptions {
    const pattern = prefixes
      .map((prefix) => {
        // catch-all (see computeMetricPrefixGroups)
        if (prefix.includes('|')) {
          return `${prefix
            .split('|')
            .map((p) => `^${p}$`)
            .join('|')}`;
        }

        return `^${prefix}.+`;
      })
      .join('|');

    const prefixesRegex = FilteredMetricsVariable.buildRegex(`(${pattern})`);

    return options.filter((option) => prefixesRegex.test(option.value as string));
  }

  private applyCategoriesFilters(options: MetricOptions, categories: string[]): MetricOptions {
    let filteredOptions: MetricOptions = [];

    for (const category of categories) {
      const categoryRegex = FilteredMetricsVariable.buildRegex(category, 'i'); // see computeMetricCategories
      filteredOptions = filteredOptions.concat(options.filter((option) => categoryRegex.test(option.value)));
    }

    return filteredOptions;
  }

  private applyNamesFilters(options: MetricOptions, names: string[]): MetricOptions {
    const [namePatterns] = names;

    const regexes = namePatterns
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((r) => {
        try {
          return new RegExp(r);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as RegExp[];

    return options.filter((option) => regexes.some((regex) => regex.test(option.value as string)));
  }

  private notifyUpdate() {
    // hack to force SceneByVariableRepeater to re-render
    this.publishEvent(new SceneVariableValueChangedEvent(this), true);
  }

  private static buildRegex(pattern: string, flags?: string) {
    try {
      return new RegExp(pattern, flags);
    } catch {
      return new RegExp('.*');
    }
  }
}
