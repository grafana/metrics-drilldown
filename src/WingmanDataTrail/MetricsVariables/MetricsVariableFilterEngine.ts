import { SceneVariableValueChangedEvent, type MultiValueVariable, type VariableValueOption } from '@grafana/scenes';
import { cloneDeep, isEqual } from 'lodash';

import { type MetricOptions } from './MetricsVariable';

export type MetricFilters = {
  prefixes: string[];
  categories: string[];
  names: string[];
};

export class MetricsVariableFilterEngine {
  private variable: MultiValueVariable;
  private initOptions: VariableValueOption[] = [];
  private filters: MetricFilters = {
    prefixes: [],
    categories: [],
    names: [],
  };

  constructor(variable: MultiValueVariable) {
    this.variable = variable;
  }

  public setInitOptions(options: VariableValueOption[]) {
    this.initOptions = cloneDeep(options);
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

      this.variable.setState({ options: this.initOptions });

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

    this.variable.setState({ options: filteredOptions });

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

    const prefixesRegex = MetricsVariableFilterEngine.buildRegex(`(${pattern})`);

    return options.filter((option) => prefixesRegex.test(option.value as string));
  }

  private applyCategoriesFilters(options: MetricOptions, categories: string[]): MetricOptions {
    let filteredOptions: MetricOptions = [];

    for (const category of categories) {
      const categoryRegex = MetricsVariableFilterEngine.buildRegex(category, 'i'); // see computeMetricCategories
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
    this.variable.publishEvent(new SceneVariableValueChangedEvent(this.variable), true);
  }

  private static buildRegex(pattern: string, flags?: string) {
    try {
      return new RegExp(pattern, flags);
    } catch {
      return new RegExp('.*');
    }
  }
}
