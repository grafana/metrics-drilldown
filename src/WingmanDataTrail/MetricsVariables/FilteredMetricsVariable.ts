import { SceneVariableValueChangedEvent, type VariableValueOption } from '@grafana/scenes';
import { cloneDeep, isEqual } from 'lodash';

import { VAR_FILTERS } from 'shared';
import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';

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
    this.subscribeToStateChange();
  }

  private subscribeToStateChange() {
    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.loading === false && prevState.loading === true) {
          this.initOptions = cloneDeep(newState.options);
        }
      })
    );
  }

  public updateGroupByQuery(groupByValue: string) {
    const matcher =
      groupByValue && groupByValue !== NULL_GROUP_BY_VALUE ? `${groupByValue}!="",$${VAR_FILTERS}` : `$${VAR_FILTERS}`;

    const query = `label_values({${matcher}}, __name__)`;

    if (query !== this.state.query) {
      this.setState({ query });
      this.refreshOptions();
    }
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
