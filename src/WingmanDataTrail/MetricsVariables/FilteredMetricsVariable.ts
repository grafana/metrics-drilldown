import { sceneGraph, SceneVariableValueChangedEvent, type VariableValueOption } from '@grafana/scenes';
import { cloneDeep, debounce, isEqual } from 'lodash';

import { QuickSearch } from 'WingmanDataTrail/HeaderControls/QuickSearch';
import { SideBar } from 'WingmanDataTrail/SideBar/SideBar';

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
    super.onActivate();

    const quickSearch = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch);
    // TODO: subscribe only to the filter sections in the side bar, once they are Scene objects (and not React components)
    const sideBar = sceneGraph.findByKeyAndType(this, 'sidebar', SideBar);

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.loading === false && prevState.loading === true) {
          this.initOptions = cloneDeep(newState.options);

          const quickSearchValue = quickSearch.state.value;
          const { selectedMetricPrefixes, selectedMetricCategories } = sideBar.state;

          this.applyFilters(
            {
              names: quickSearchValue ? [quickSearchValue] : [],
              prefixes: selectedMetricPrefixes,
              categories: selectedMetricCategories,
            },
            // force update to ensure the options are filtered
            // need specifically when selecting a different group by label
            true
          );
        }
      })
    );

    this.subscribeToFiltersChange(quickSearch, sideBar);
  }

  private subscribeToFiltersChange(quickSearch: QuickSearch, sideBar: SideBar) {
    this._subs.add(
      quickSearch.subscribeToState(
        debounce((newState, prevState) => {
          if (newState.value !== prevState.value) {
            this.applyFilters({ names: newState.value ? [newState.value] : [] });
            this.notifyUpdate();
          }
        }, 250)
      )
    );

    this._subs.add(
      sideBar.subscribeToState((newState, prevState) => {
        if (!isEqual(newState.selectedMetricPrefixes, prevState.selectedMetricPrefixes)) {
          this.applyFilters({ prefixes: newState.selectedMetricPrefixes });
          this.notifyUpdate();
          return;
        }

        if (!isEqual(newState.selectedMetricCategories, prevState.selectedMetricCategories)) {
          this.applyFilters({ categories: newState.selectedMetricCategories });
          this.notifyUpdate();
          return;
        }
      })
    );
  }

  private applyFilters(filters: Partial<MetricFilters> = this.filters, forceUpdate = false) {
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

      this.setState({
        options: this.initOptions,
      });

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

    this.setState({
      options: filteredOptions,
    });
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
